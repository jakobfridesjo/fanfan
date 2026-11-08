use std::fs;
use std::path::{Path, PathBuf};

use candle_core::Device;
use moss_tts_nano_rust_candle::pipeline::{GenerateParams, MossTTS, SAMPLE_RATE};
use ogg::{PacketWriteEndInfo, PacketWriter};
use opus::{Application, Bitrate, Channels, Encoder};
use sha2::{Digest, Sha256};

use crate::error::{Error, Result};

/// Everything `load` reads from the voice folder.
pub const FILES: [&str; 6] = [
    "tokenizer.model",
    "config.json",
    "moss_tts_nano_lm.safetensors",
    "moss_audio_tokenizer_config.json",
    "moss_audio_tokenizer.safetensors",
    "reference.flac",
];

/// Names the model, reference voice and generation settings. Change it when
/// any of them change, so cached audio from the old voice is not played.
pub const VOICE_ID: &str = "moss-tts-nano-f4d3fcf4-zh_1-v1";

/// About 6 seconds at 12.5 frames a second: more than any word needs.
const MIN_MAX_FRAMES: usize = 75;
/// About 2.5 characters a second, well below how fast the voice reads.
const FRAMES_PER_CHAR: usize = 5;

/// Longer texts are saved under their SHA-256, keeping file names short.
const MAX_HEX_NAMED_BYTES: usize = 64;

const OPUS_BITRATE: i32 = 64_000;
/// 20 ms at 48 kHz, the usual Opus frame.
const OPUS_FRAME: usize = 960;
const OGG_SERIAL: u32 = 1;

/// MOSS-TTS-Nano from `mise voice:fetch`, run on the CPU by its Candle port,
/// speaking in the voice of `reference.flac`.
pub struct Voice {
    tts: MossTTS,
    reference: PathBuf,
}

impl Voice {
    pub fn load(dir: &Path) -> Result<Self> {
        if let Some(missing) = FILES.iter().find(|name| !dir.join(name).is_file()) {
            return Err(Error::Voice(format!("{} has no {missing}", dir.display())));
        }
        let [tokenizer, config, lm, codec_config, codec, reference] =
            FILES.map(|name| dir.join(name));
        let tts = MossTTS::load(tokenizer, config, lm, codec_config, codec, &Device::Cpu).map_err(
            |error| Error::Voice(format!("could not load {}: {error:#}", dir.display())),
        )?;
        Ok(Self { tts, reference })
    }

    /// Speaks `text`, a word or a phrase, as a mono Ogg Opus file. A fixed
    /// seed makes it sound the same every time.
    pub fn speak(&self, text: &str) -> Result<Vec<u8>> {
        let params = GenerateParams {
            max_frames: MIN_MAX_FRAMES.max(text.chars().count() * FRAMES_PER_CHAR),
            do_sample: true,
            text_temperature: 1.0,
            text_top_p: 1.0,
            text_top_k: 50,
            audio_temperature: 0.8,
            audio_top_p: 0.95,
            audio_top_k: 25,
            audio_repetition_penalty: 1.2,
            // Ends Chinese with "。", as upstream always does: without a
            // sentence end the model does not know the word is over.
            normalize_text: true,
            seed: Some(40),
            export_dir: None,
            voice_clone_max_text_tokens: 0,
        };
        let could_not_speak =
            |error: anyhow::Error| Error::Voice(format!("could not speak \"{text}\": {error:#}"));
        let stereo = self
            .tts
            .voice_clone(text, &self.reference, &params)
            .map_err(could_not_speak)?;
        let mono = stereo
            .mean(0)
            .and_then(|channel| channel.to_vec1::<f32>())
            .map_err(|error| could_not_speak(error.into()))?;
        if mono.is_empty() {
            return Err(Error::Voice(format!("could not speak \"{text}\"")));
        }
        ogg_opus(&mono)
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
        Encoder::new(SAMPLE_RATE as u32, Channels::Mono, Application::Audio).map_err(opus_error)?;
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
    head.extend_from_slice(&(SAMPLE_RATE as u32).to_le_bytes());
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

        let mut decoder = Decoder::new(SAMPLE_RATE as u32, Channels::Mono).unwrap();
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
