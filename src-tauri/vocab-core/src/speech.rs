mod graph;

use std::collections::HashMap;
use std::fs;
use std::iter;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;

use anyhow::{Context, bail};
use ogg::{PacketWriteEndInfo, PacketWriter};
use opus::{Application, Bitrate, Channels, Encoder};
use sentencepiece::SentencePieceProcessor;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tract_linalg::multithread::{Executor, multithread_tract_scope};
use tract_onnx::prelude::*;

use crate::error::{Error, Result};
use graph::Graph;

const TOKENIZER: &str = "tokenizer.model";
const MANIFEST: &str = "browser_poc_manifest.json";
const PREFILL: &str = "moss_tts_prefill.onnx";
const DECODE_STEP: &str = "moss_tts_decode_step.onnx";
const SAMPLER: &str = "moss_tts_local_fixed_sampled_frame.onnx";
const CODEC: &str = "moss_audio_tokenizer_decode_full.onnx";

/// Everything `load` reads from the voice folder.
pub const FILES: [&str; 9] = [
    TOKENIZER,
    MANIFEST,
    PREFILL,
    DECODE_STEP,
    "moss_tts_global_shared_int8.data",
    SAMPLER,
    "moss_tts_local_fixed_sampled_frame_int8.data",
    CODEC,
    "moss_audio_tokenizer_decode_shared.data",
];

/// Names the model, voice and generation settings. Change it when any of
/// them change, so cached audio from the old voice is not played.
pub const VOICE_ID: &str = "moss-tts-nano-int8-23fd1979-junhao-v1";

/// Upstream's `zh_1.wav`, which the manifest carries already encoded.
const VOICE: &str = "Junhao";
const SEED: u64 = 40;

/// About 6 seconds at 12.5 frames a second: more than any word needs.
const MIN_MAX_FRAMES: usize = 75;
/// About 2.5 characters a second, well below how fast the voice reads.
const FRAMES_PER_CHAR: usize = 5;

/// tract runs the prompt only at a fixed length, so prompts are padded to a
/// multiple of this, and each length is compiled once.
const PREFILL_ROWS: usize = 64;

/// Longer texts are saved under their SHA-256, keeping file names short.
const MAX_HEX_NAMED_BYTES: usize = 64;

const SAMPLE_RATE: u32 = 48_000;
const OPUS_BITRATE: i32 = 64_000;
/// 20 ms at 48 kHz, the usual Opus frame.
const OPUS_FRAME: usize = 960;
const OGG_SERIAL: u32 = 1;

/// The parts of `browser_poc_manifest.json` that build the prompt.
#[derive(Deserialize)]
struct Manifest {
    tts_config: TokenIds,
    prompt_templates: PromptTemplates,
    builtin_voices: Vec<BuiltinVoice>,
}

#[derive(Deserialize)]
struct TokenIds {
    n_vq: usize,
    audio_codebook_sizes: Vec<usize>,
    pad_token_id: i32,
    audio_pad_token_id: i32,
    audio_start_token_id: i32,
    audio_end_token_id: i32,
    audio_user_slot_token_id: i32,
    audio_assistant_slot_token_id: i32,
}

#[derive(Deserialize)]
struct PromptTemplates {
    user_prompt_prefix_token_ids: Vec<i32>,
    user_prompt_after_reference_token_ids: Vec<i32>,
    assistant_prompt_prefix_token_ids: Vec<i32>,
}

#[derive(Deserialize)]
struct BuiltinVoice {
    voice: String,
    prompt_audio_codes: Vec<Vec<i32>>,
}

/// MOSS-TTS-Nano from `mise voice:fetch`, its language model quantized to
/// int8, run on every CPU core by tract and speaking in the `VOICE` voice.
pub struct Voice {
    executor: Executor,
    dir: PathBuf,
    tokenizer: SentencePieceProcessor,
    ids: TokenIds,
    /// The prompt's rows before the text: instructions and the voice sample.
    prompt_start: Vec<i32>,
    /// The prompt's tokens between the voice sample and the text.
    before_text: Vec<i32>,
    /// The prompt's tokens after the text, up to where speech starts.
    after_text: Vec<i32>,
    /// The prompt runner for each padded length used so far.
    prefills: Mutex<HashMap<usize, Graph>>,
    decode_step: Graph,
    sampler: Graph,
    codec: Graph,
}

impl Voice {
    pub fn load(dir: &Path) -> Result<Self> {
        if let Some(missing) = FILES.iter().find(|name| !dir.join(name).is_file()) {
            return Err(Error::Voice(format!("{} has no {missing}", dir.display())));
        }
        let cores = thread::available_parallelism().map_or(1, |cores| cores.get());
        let executor = Executor::multithread_with_name(cores, "speech");
        multithread_tract_scope(executor.clone(), || Self::load_files(dir, executor))
            .map_err(|error| Error::Voice(format!("could not load {}: {error:#}", dir.display())))
    }

    fn load_files(dir: &Path, executor: Executor) -> TractResult<Self> {
        let manifest: Manifest = serde_json::from_slice(&fs::read(dir.join(MANIFEST))?)?;
        let ids = manifest.tts_config;
        let codes = manifest
            .builtin_voices
            .into_iter()
            .find(|voice| voice.voice == VOICE)
            .with_context(|| format!("{MANIFEST} has no voice {VOICE}"))?
            .prompt_audio_codes;
        let templates = manifest.prompt_templates;
        let mut prompt_start: Vec<i32> = templates
            .user_prompt_prefix_token_ids
            .iter()
            .chain([&ids.audio_start_token_id])
            .flat_map(|&token| ids.text_row(token))
            .collect();
        for frame in codes {
            prompt_start.extend(ids.audio_row(ids.audio_user_slot_token_id, &frame));
        }
        let before_text = iter::once(ids.audio_end_token_id)
            .chain(templates.user_prompt_after_reference_token_ids)
            .collect();
        let after_text = templates
            .assistant_prompt_prefix_token_ids
            .into_iter()
            .chain([ids.audio_start_token_id])
            .collect();
        Ok(Self {
            executor,
            tokenizer: SentencePieceProcessor::open(dir.join(TOKENIZER))?,
            decode_step: graph::load(
                dir,
                DECODE_STEP,
                &[("input_ids", None), ("past_valid_lengths", None)],
            )?,
            sampler: graph::load(
                dir,
                SAMPLER,
                &[
                    ("global_hidden", None),
                    ("repetition_seen_mask", None),
                    ("assistant_random_u", None),
                    ("audio_random_u", None),
                ],
            )?,
            codec: graph::load(
                dir,
                CODEC,
                &[("audio_codes", None), ("audio_code_lengths", None)],
            )?,
            prefills: Mutex::default(),
            dir: dir.to_owned(),
            ids,
            prompt_start,
            before_text,
            after_text,
        })
    }

    /// Speaks `text`, a word or a phrase, as a mono Ogg Opus file. A fixed
    /// seed makes it sound the same every time.
    pub fn speak(&self, text: &str) -> Result<Vec<u8>> {
        let could_not_speak =
            |reason: String| Error::Voice(format!("could not speak \"{text}\"{reason}"));
        let samples = multithread_tract_scope(self.executor.clone(), || {
            self.generate(text)
                .and_then(|frames| self.decode_audio(&frames))
        })
        .map_err(|error| could_not_speak(format!(": {error:#}")))?;
        if samples.is_empty() {
            return Err(could_not_speak(String::new()));
        }
        ogg_opus(&samples)
    }

    /// The audio codes of `text` spoken, `n_vq` to a frame.
    fn generate(&self, text: &str) -> TractResult<Vec<i32>> {
        let text = with_sentence_end(text);
        let text_ids = self
            .tokenizer
            .encode(&text)?
            .into_iter()
            .map(|piece| piece.id as i32);
        let mut prompt = self.prompt_start.clone();
        for token in self
            .before_text
            .iter()
            .copied()
            .chain(text_ids)
            .chain(self.after_text.iter().copied())
        {
            prompt.extend(self.ids.text_row(token));
        }
        let (mut hidden, mut cache) = self.prefill(&prompt)?;
        let prompt_rows = prompt.len() / self.ids.row_width();

        let (channels, codebook) = (self.ids.n_vq, self.ids.codebook_size()?);
        let mut seen = vec![0i32; channels * codebook];
        let mut random = Random(SEED);
        let mut frames = Vec::new();
        let max_frames = MIN_MAX_FRAMES.max(text.chars().count() * FRAMES_PER_CHAR);
        for past in (prompt_rows..).take(max_frames) {
            let audio_random: Vec<f32> = (0..channels).map(|_| random.uniform()).collect();
            let sampled = self.sampler.run(tvec![
                hidden.into_tvalue(),
                Tensor::from_shape(&[1, channels, codebook], &seen)?.into_tvalue(),
                tensor1(&[random.uniform()]).into_tvalue(),
                Tensor::from_shape(&[1, channels], &audio_random)?.into_tvalue(),
            ])?;
            if integers(&sampled[0])?[0] == 0 {
                break;
            }
            let frame = integers(&sampled[1])?;
            for (channel, &token) in frame.iter().enumerate() {
                let index = usize::try_from(token)
                    .ok()
                    .filter(|&token| token < codebook);
                let index = index.context("the sampler chose a code outside the codebook")?;
                seen[channel * codebook + index] = 1;
            }
            let row = self
                .ids
                .audio_row(self.ids.audio_assistant_slot_token_id, &frame);
            frames.extend(frame);

            let mut inputs = tvec![
                Tensor::from_shape(&[1, 1, row.len()], &row)?.into_tvalue(),
                tensor1(&[past as i32]).into_tvalue(),
            ];
            inputs.extend(cache);
            let mut outputs = self.decode_step.run(inputs)?;
            hidden = position(&outputs[0], 0)?;
            cache = outputs.drain(1..).collect();
        }
        Ok(frames)
    }

    /// Runs the prompt padded to a multiple of `PREFILL_ROWS`, which the
    /// attention mask hides: the hidden state at its last row, and the
    /// attention cache of its rows.
    fn prefill(&self, prompt: &[i32]) -> TractResult<(Tensor, TVec<TValue>)> {
        let width = self.ids.row_width();
        let rows = prompt.len() / width;
        let padded = rows.next_multiple_of(PREFILL_ROWS);
        let graph = self.prefill_graph(padded)?;
        let mut input_ids = prompt.to_vec();
        let padding = self.ids.text_row(self.ids.pad_token_id);
        input_ids.extend(padding.iter().cycle().take((padded - rows) * width));
        let mask: Vec<i32> = (0..padded).map(|row| i32::from(row < rows)).collect();
        let outputs = graph.run(tvec![
            Tensor::from_shape(&[1, padded, width], &input_ids)?.into_tvalue(),
            Tensor::from_shape(&[1, padded], &mask)?.into_tvalue(),
        ])?;
        let hidden = position(&outputs[0], rows - 1)?;
        let cache = outputs[1..]
            .iter()
            .map(|layer| Ok(layer.slice(1, 0, rows)?.into_tvalue()))
            .collect::<TractResult<_>>()?;
        Ok((hidden, cache))
    }

    fn prefill_graph(&self, rows: usize) -> TractResult<Graph> {
        let mut prefills = self
            .prefills
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(graph) = prefills.get(&rows) {
            return Ok(graph.clone());
        }
        let width = self.ids.row_width();
        let graph = graph::load(
            &self.dir,
            PREFILL,
            &[
                ("input_ids", Some(i32::fact([1, rows, width]).into())),
                ("attention_mask", Some(i32::fact([1, rows]).into())),
            ],
        )?;
        prefills.insert(rows, graph.clone());
        Ok(graph)
    }

    /// Mono 48 kHz audio from the audio codes.
    fn decode_audio(&self, frames: &[i32]) -> TractResult<Vec<f32>> {
        let count = frames.len() / self.ids.n_vq;
        if count == 0 {
            return Ok(Vec::new());
        }
        let outputs = self.codec.run(tvec![
            Tensor::from_shape(&[1, count, self.ids.n_vq], frames)?.into_tvalue(),
            tensor1(&[count as i32]).into_tvalue(),
        ])?;
        let audio = outputs[0].to_plain_array_view::<f32>()?;
        let [1, channels, samples] = *audio.shape() else {
            bail!("the codec returned audio shaped {:?}", audio.shape());
        };
        let length = (integers(&outputs[1])?[0] as usize).min(samples);
        Ok((0..length)
            .map(|sample| {
                (0..channels)
                    .map(|channel| audio[[0, channel, sample]])
                    .sum::<f32>()
                    / channels as f32
            })
            .collect())
    }
}

impl TokenIds {
    /// A prompt row holds a text token followed by one code per audio channel.
    fn row_width(&self) -> usize {
        1 + self.n_vq
    }

    fn text_row(&self, token: i32) -> Vec<i32> {
        iter::once(token)
            .chain(iter::repeat_n(self.audio_pad_token_id, self.n_vq))
            .collect()
    }

    fn audio_row(&self, slot: i32, codes: &[i32]) -> Vec<i32> {
        let codes = codes
            .iter()
            .copied()
            .chain(iter::repeat(self.audio_pad_token_id));
        iter::once(slot).chain(codes.take(self.n_vq)).collect()
    }

    fn codebook_size(&self) -> TractResult<usize> {
        match self.audio_codebook_sizes.as_slice() {
            [size, rest @ ..] if rest.iter().all(|other| other == size) => Ok(*size),
            sizes => bail!("the audio channels have codebooks of sizes {sizes:?}"),
        }
    }
}

/// Ends `text` with "。" unless it ends a sentence already, as upstream does:
/// without a sentence end the model does not know the word is over.
fn with_sentence_end(text: &str) -> String {
    let text = text.trim();
    if text.ends_with(['。', '！', '？', '；', '.', '!', '?', ';']) {
        text.to_owned()
    } else {
        format!("{text}。")
    }
}

/// The hidden state at `index` of a `[1, positions, hidden]` tensor.
fn position(states: &Tensor, index: usize) -> TractResult<Tensor> {
    let hidden = *states
        .shape()
        .last()
        .context("the hidden state has no dimensions")?;
    states.slice(1, index, index + 1)?.into_shape(&[1, hidden])
}

fn integers(tensor: &Tensor) -> TractResult<Vec<i32>> {
    Ok(tensor
        .cast_to::<i32>()?
        .to_plain_array_view::<i32>()?
        .iter()
        .copied()
        .collect())
}

/// SplitMix64, giving the sampler its uniform numbers from a fixed seed.
struct Random(u64);

impl Random {
    /// A number strictly between 0 and 1.
    fn uniform(&mut self) -> f32 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut bits = self.0;
        bits = (bits ^ (bits >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        bits = (bits ^ (bits >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        bits ^= bits >> 31;
        ((bits >> 40) as f32 + 0.5) / (1u64 << 24) as f32
    }
}

/// Spoken text saved as `<dir>/<hex of the text>.opus` (`sha256-<hex of its
/// hash>.opus` when long), so each is generated once.
pub struct SpeechCache {
    dir: PathBuf,
}

impl SpeechCache {
    /// Keeps audio under `root/VOICE_ID`.
    pub fn new(root: &Path) -> Self {
        Self {
            dir: root.join(VOICE_ID),
        }
    }

    /// The saved audio for `text`, or `speak(text)` saved for next time.
    pub fn get_or_speak(
        &self,
        text: &str,
        speak: impl FnOnce(&str) -> Result<Vec<u8>>,
    ) -> Result<Vec<u8>> {
        let path = self.path(text);
        if let Ok(audio) = fs::read(&path) {
            return Ok(audio);
        }
        let audio = speak(text)?;
        fs::create_dir_all(&self.dir)?;
        // Renaming into place means a crash never leaves half a file behind.
        let partial = path.with_extension("opus.part");
        fs::write(&partial, &audio)?;
        fs::rename(&partial, &path)?;
        Ok(audio)
    }

    fn path(&self, text: &str) -> PathBuf {
        let name = if text.len() <= MAX_HEX_NAMED_BYTES {
            hex(text.as_bytes())
        } else {
            format!("sha256-{}", hex(&Sha256::digest(text)))
        };
        self.dir.join(format!("{name}.opus"))
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Encodes 48 kHz mono samples as Ogg Opus (RFC 7845).
fn ogg_opus(samples: &[f32]) -> Result<Vec<u8>> {
    let opus_error = |error: opus::Error| Error::Voice(format!("could not encode audio: {error}"));
    let mut encoder =
        Encoder::new(SAMPLE_RATE, Channels::Mono, Application::Audio).map_err(opus_error)?;
    encoder
        .set_bitrate(Bitrate::Bits(OPUS_BITRATE))
        .map_err(opus_error)?;
    let pre_skip = encoder.get_lookahead().map_err(opus_error)? as usize;

    let mut writer = PacketWriter::new(Vec::new());
    writer.write_packet(
        opus_head(pre_skip as u16),
        OGG_SERIAL,
        PacketWriteEndInfo::EndPage,
        0,
    )?;
    writer.write_packet(opus_tags(), OGG_SERIAL, PacketWriteEndInfo::EndPage, 0)?;

    // The encoder delays its output by `pre_skip` samples, so feed that much
    // silence after the audio and pad the last frame; the final granule
    // position tells the decoder where the real audio ends.
    let mut input = samples.to_vec();
    input.resize(
        (samples.len() + pre_skip).div_ceil(OPUS_FRAME) * OPUS_FRAME,
        0.0,
    );
    let frames = input.len() / OPUS_FRAME;
    let mut packet = [0u8; 4000];
    for (index, frame) in input.chunks(OPUS_FRAME).enumerate() {
        let len = encoder
            .encode_float(frame, &mut packet)
            .map_err(opus_error)?;
        let last = index + 1 == frames;
        let (end, granule) = if last {
            (PacketWriteEndInfo::EndStream, pre_skip + samples.len())
        } else {
            (PacketWriteEndInfo::NormalPacket, (index + 1) * OPUS_FRAME)
        };
        writer.write_packet(packet[..len].to_vec(), OGG_SERIAL, end, granule as u64)?;
    }
    Ok(writer.into_inner())
}

fn opus_head(pre_skip: u16) -> Vec<u8> {
    let mut head = b"OpusHead".to_vec();
    head.push(1); // version
    head.push(1); // channels
    head.extend_from_slice(&pre_skip.to_le_bytes());
    head.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    head.extend_from_slice(&0i16.to_le_bytes()); // output gain
    head.push(0); // channel mapping family: mono or stereo
    head
}

fn opus_tags() -> Vec<u8> {
    let vendor = b"vocab-core";
    let mut tags = b"OpusTags".to_vec();
    tags.extend_from_slice(&(vendor.len() as u32).to_le_bytes());
    tags.extend_from_slice(vendor);
    tags.extend_from_slice(&0u32.to_le_bytes()); // no comments
    tags
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;
    use std::io::Cursor;

    use ogg::PacketReader;
    use opus::Decoder;

    use super::*;

    fn tone(seconds: f32) -> Vec<f32> {
        let len = (SAMPLE_RATE as f32 * seconds) as usize;
        (0..len)
            .map(|index| {
                (index as f32 * 440.0 * std::f32::consts::TAU / SAMPLE_RATE as f32).sin() * 0.5
            })
            .collect()
    }

    #[test]
    fn encodes_ogg_opus_that_decodes_to_the_same_length() {
        let samples = tone(0.33);
        let bytes = ogg_opus(&samples).unwrap();

        let mut reader = PacketReader::new(Cursor::new(bytes));
        let head = reader.read_packet_expected().unwrap();
        assert_eq!(&head.data[..8], b"OpusHead");
        assert_eq!(head.data[9], 1);
        let pre_skip = u16::from_le_bytes([head.data[10], head.data[11]]) as usize;
        assert_eq!(
            &reader.read_packet_expected().unwrap().data[..8],
            b"OpusTags"
        );

        let mut decoder = Decoder::new(SAMPLE_RATE, Channels::Mono).unwrap();
        let mut decoded = 0;
        let mut last = None;
        while let Some(packet) = reader.read_packet().unwrap() {
            let mut output = [0f32; OPUS_FRAME];
            decoded += decoder
                .decode_float(&packet.data, &mut output, false)
                .unwrap();
            last = Some((packet.absgp_page(), packet.last_in_stream()));
        }
        let (granule, end_of_stream) = last.unwrap();
        assert!(end_of_stream);
        assert_eq!(granule as usize - pre_skip, samples.len());
        assert!(decoded >= samples.len() + pre_skip);
    }

    #[test]
    fn keeps_spoken_words_and_reuses_them() {
        let root = tempfile::tempdir().unwrap();
        let cache = SpeechCache::new(root.path());
        let calls = Cell::new(0);
        let speak = |word: &str| {
            calls.set(calls.get() + 1);
            Ok(word.as_bytes().to_vec())
        };

        assert_eq!(
            cache.get_or_speak("学习", speak).unwrap(),
            "学习".as_bytes()
        );
        assert_eq!(
            cache.get_or_speak("学习", speak).unwrap(),
            "学习".as_bytes()
        );
        assert_eq!(cache.get_or_speak("行", speak).unwrap(), "行".as_bytes());

        assert_eq!(calls.get(), 2);
        let saved = root.path().join(VOICE_ID).join("e5ada6e4b9a0.opus");
        assert_eq!(fs::read(saved).unwrap(), "学习".as_bytes());

        let sentence = "我们学习中文，很好。".repeat(3);
        assert_eq!(
            cache.get_or_speak(&sentence, speak).unwrap(),
            sentence.as_bytes()
        );
        let name = cache.path(&sentence);
        let name = name.file_name().unwrap().to_str().unwrap();
        assert!(name.starts_with("sha256-") && name.len() < 100, "{name}");
    }

    #[test]
    fn saves_nothing_when_speaking_fails() {
        let root = tempfile::tempdir().unwrap();
        let cache = SpeechCache::new(root.path());

        let result = cache.get_or_speak("学习", |_| Err(Error::Voice("no voice".into())));

        assert!(result.is_err());
        assert!(!root.path().join(VOICE_ID).exists());
    }

    #[test]
    fn reports_a_missing_voice() {
        let error = Voice::load(Path::new("/nonexistent/voice")).err().unwrap();
        assert!(error.to_string().contains("tokenizer.model"));
    }

    /// Needs the real voice: `mise voice:fetch`, then `cargo test -p vocab-core -- --ignored`.
    #[test]
    #[ignore]
    fn speaks_simplified_and_traditional_words() {
        let voice =
            Voice::load(&Path::new(env!("CARGO_MANIFEST_DIR")).join("../resources/voice")).unwrap();
        for word in [
            "学习",
            "學習",
            "行",
            "他说：“我们明天一起去图书馆学习中文，好吗？”",
        ] {
            let bytes = voice.speak(word).unwrap();
            assert_eq!(&bytes[..4], b"OggS", "{word} is not Ogg");
        }
    }
}
