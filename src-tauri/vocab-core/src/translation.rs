use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::thread;

use anyhow::{Context, ensure};
use sentencepiece::SentencePieceProcessor;
use tract_linalg::multithread::{Executor, multithread_tract_scope};
use tract_onnx::prelude::*;

use crate::error::{Error, Result};
use crate::onnx::{self, Graph};

const SOURCE_TOKENIZER: &str = "source.spm";
const VOCABULARY: &str = "vocab.json";
const ENCODER: &str = "encoder_model_quantized.onnx";
const FIRST_STEP: &str = "decoder_model_quantized.onnx";
const NEXT_STEP: &str = "decoder_with_past_model_quantized.onnx";

/// Everything `load` reads from the translator folder.
pub const FILES: [&str; 5] = [SOURCE_TOKENIZER, VOCABULARY, ENCODER, FIRST_STEP, NEXT_STEP];

const LAYERS: usize = 6;
/// Ends the source and the translation.
const END: i64 = 0;
/// Starts the translation; never chosen as output.
const PAD: i64 = 65_000;
const UNKNOWN: &str = "<unk>";
/// The decoder names the source's length a second way for its cache.
const SOURCE_LENGTH: [(&str, &str); 1] =
    [("encoder_sequence_length_out", "encoder_sequence_length")];
/// The model's positional embeddings stop here.
const MAX_POSITIONS: usize = 512;
/// English rarely needs more than this many tokens a source token.
const TARGET_TOKENS_PER_SOURCE_TOKEN: usize = 3;
/// SentencePiece marks a word's start with this instead of a space.
const WORD_START: char = '▁';

/// Helsinki-NLP's opus-mt-zh-en (Marian), its graphs quantized to int8 by
/// Xenova, downloaded by `models`. Translates Chinese in either script
/// to English, greedily, on every CPU core.
pub struct Translator {
    executor: Executor,
    tokenizer: SentencePieceProcessor,
    /// Both languages share one vocabulary, numbered by `vocab.json`.
    ids: HashMap<String, i64>,
    pieces: Vec<String>,
    unknown: i64,
    encoder: Graph,
    first_step: Graph,
    next_step: Graph,
}

impl Translator {
    pub fn load(dir: &Path) -> Result<Self> {
        if let Some(missing) = FILES.iter().find(|name| !dir.join(name).is_file()) {
            return Err(Error::Translation(format!(
                "{} has no {missing}",
                dir.display()
            )));
        }
        let cores = thread::available_parallelism().map_or(1, |cores| cores.get());
        let executor = Executor::multithread_with_name(cores, "translation");
        multithread_tract_scope(executor.clone(), || Self::load_files(dir, executor)).map_err(
            |error| Error::Translation(format!("could not load {}: {error:#}", dir.display())),
        )
    }

    fn load_files(dir: &Path, executor: Executor) -> TractResult<Self> {
        let ids: HashMap<String, i64> = serde_json::from_slice(&fs::read(dir.join(VOCABULARY))?)?;
        let mut pieces = vec![String::new(); ids.len()];
        for (piece, &id) in &ids {
            let slot = usize::try_from(id)
                .ok()
                .and_then(|id| pieces.get_mut(id))
                .with_context(|| format!("{VOCABULARY} numbers {piece} {id}"))?;
            *slot = piece.clone();
        }
        let unknown = *ids
            .get(UNKNOWN)
            .with_context(|| format!("{VOCABULARY} has no {UNKNOWN}"))?;
        let past: Vec<String> = (0..LAYERS)
            .flat_map(|layer| {
                [
                    "decoder.key",
                    "decoder.value",
                    "encoder.key",
                    "encoder.value",
                ]
                .map(|name| format!("past_key_values.{layer}.{name}"))
            })
            .collect();
        let next_step_inputs: Vec<(&str, Option<InferenceFact>)> =
            ["encoder_attention_mask", "input_ids"]
                .into_iter()
                .chain(past.iter().map(String::as_str))
                .map(|name| (name, None))
                .collect();
        Ok(Self {
            executor,
            tokenizer: SentencePieceProcessor::open(dir.join(SOURCE_TOKENIZER))?,
            ids,
            pieces,
            unknown,
            encoder: onnx::load(
                dir,
                ENCODER,
                &[("input_ids", None), ("attention_mask", None)],
                &[],
            )?,
            first_step: onnx::load(
                dir,
                FIRST_STEP,
                &[
                    ("encoder_attention_mask", None),
                    ("input_ids", None),
                    ("encoder_hidden_states", None),
                ],
                &SOURCE_LENGTH,
            )?,
            next_step: onnx::load(dir, NEXT_STEP, &next_step_inputs, &SOURCE_LENGTH)?,
        })
    }

    /// `text`, a sentence or a few, in English.
    pub fn translate(&self, text: &str) -> Result<String> {
        multithread_tract_scope(self.executor.clone(), || self.generate(text.trim()))
            .map(|ids| self.detokenize(&ids))
            .map_err(|error| {
                Error::Translation(format!("could not translate \"{text}\": {error:#}"))
            })
    }

    fn generate(&self, text: &str) -> TractResult<Vec<i64>> {
        let mut source: Vec<i64> = self
            .tokenizer
            .encode(text)?
            .into_iter()
            .map(|piece| self.ids.get(&piece.piece).copied().unwrap_or(self.unknown))
            .collect();
        if source.is_empty() {
            return Ok(Vec::new());
        }
        source.truncate(MAX_POSITIONS - 1);
        source.push(END);
        let length = source.len();
        let mask = Tensor::from_shape(&[1, length], &vec![1i64; length])?.into_tvalue();
        let hidden = self
            .encoder
            .run(tvec![
                Tensor::from_shape(&[1, length], &source)?.into_tvalue(),
                mask.clone(),
            ])?
            .remove(0);

        let max_tokens = (length * TARGET_TOKENS_PER_SOURCE_TOKEN).min(MAX_POSITIONS);
        let mut outputs = self
            .first_step
            .run(tvec![mask.clone(), token(PAD)?, hidden])?;
        // Each layer's cache: the translation's keys and values so far, then
        // the source's, which stay the same at every step.
        let mut cache: Vec<TValue> = outputs.drain(1..).collect();
        ensure!(
            cache.len() == LAYERS * 4,
            "the decoder returned {} caches",
            cache.len()
        );
        let mut translation = Vec::new();
        loop {
            let next = most_likely(&outputs[0])?;
            if next == END || translation.len() == max_tokens {
                break;
            }
            translation.push(next);
            let mut inputs = tvec![mask.clone(), token(next)?];
            inputs.extend(cache.iter().cloned());
            outputs = self.next_step.run(inputs)?;
            for (layer, present) in outputs.drain(1..).collect::<Vec<_>>().chunks(2).enumerate() {
                cache[layer * 4..layer * 4 + 2].clone_from_slice(present);
            }
        }
        Ok(translation)
    }

    fn detokenize(&self, ids: &[i64]) -> String {
        let text: String = ids
            .iter()
            .filter(|&&id| id != self.unknown)
            .filter_map(|&id| self.pieces.get(usize::try_from(id).ok()?))
            .map(String::as_str)
            .collect();
        text.replace(WORD_START, " ").trim().to_owned()
    }
}

fn token(id: i64) -> TractResult<TValue> {
    Ok(Tensor::from_shape(&[1, 1], &[id])?.into_tvalue())
}

/// The likeliest next token from `[1, 1, vocabulary]` logits, never `PAD`.
fn most_likely(logits: &TValue) -> TractResult<i64> {
    let logits = logits.to_plain_array_view::<f32>()?;
    let (best, _) = logits
        .iter()
        .enumerate()
        .filter(|&(id, _)| id as i64 != PAD)
        .max_by(|(_, a), (_, b)| a.total_cmp(b))
        .context("the decoder returned no logits")?;
    Ok(best as i64)
}

#[cfg(test)]
mod tests {
    use std::time::Instant;

    use super::*;

    /// Needs the real translator, which it downloads into `target/models` the first time.
    #[test]
    #[ignore]
    fn translates_simplified_and_traditional_sentences() {
        let translator =
            Translator::load(&crate::models::downloaded(crate::models::Model::Translator)).unwrap();
        for (text, expected) in [
            ("我们明天一起去图书馆学习中文。", "library"),
            ("我們明天一起去圖書館學習中文。", "library"),
            ("他说：“我不知道。”", "know"),
        ] {
            let start = Instant::now();
            let english = translator.translate(text).unwrap();
            println!("{text} -> {english} ({:?})", start.elapsed());
            assert!(english.contains(expected), "{text} became \"{english}\"");
        }
        assert_eq!(translator.translate("  ").unwrap(), "");
    }
}
