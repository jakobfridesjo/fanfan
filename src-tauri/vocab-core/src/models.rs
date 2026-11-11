//! The voice and translator, downloaded on request from their pinned Hugging
//! Face revisions into the app's data folder instead of shipping in the app.
//!
//! Each file downloads as `<name>.part`, resumes from where a dropped
//! connection left it, and takes its own name only once its SHA-256 matches,
//! so a model whose files all exist is complete.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::{Error, Result};

const VOICE_MODELS: &str = "https://huggingface.co/REALBITS/MOSS-TTS-Nano-100M-ONNX-int8/resolve/23fd19793be20a4f3f6aacd4e3a2130c8e3d2519";
const VOICE_CODEC: &str = "https://huggingface.co/OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX/resolve/ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae";
const TRANSLATOR: &str =
    "https://huggingface.co/Xenova/opus-mt-zh-en/resolve/39d480d52a9ea3065a1f117adfe4dbc55de10e6f";
const TRANSLATOR_GRAPHS: &str = "https://huggingface.co/Xenova/opus-mt-zh-en/resolve/39d480d52a9ea3065a1f117adfe4dbc55de10e6f/onnx";

/// Progress is reported each time this much more has arrived.
const PROGRESS_STEP: u64 = 1 << 20;
const CHUNK: usize = 1 << 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Model {
    /// MOSS-TTS-Nano and its audio codec, for `speech::Voice`.
    Voice,
    /// opus-mt-zh-en, for `translation::Translator`.
    Translator,
}

pub struct ModelFile {
    /// Its name in the model's folder, as `Voice::load` or `Translator::load` reads it.
    pub name: &'static str,
    /// The folder it downloads from.
    url: &'static str,
    bytes: u64,
    sha256: &'static str,
}

const fn file(
    name: &'static str,
    url: &'static str,
    bytes: u64,
    sha256: &'static str,
) -> ModelFile {
    ModelFile {
        name,
        url,
        bytes,
        sha256,
    }
}

const VOICE_FILES: [ModelFile; 9] = [
    file(
        "tokenizer.model",
        VOICE_MODELS,
        470_897,
        "c353ee1479b536bf414c1b247f5542b6607fb8ae91320e5af1781fee200fddff",
    ),
    file(
        "browser_poc_manifest.json",
        VOICE_MODELS,
        503_354,
        "097d80e993dc29f0bae427590b4f77084a161cb578b50d82c29f455d5faa9eee",
    ),
    file(
        "moss_tts_prefill.onnx",
        VOICE_MODELS,
        477_742,
        "25409338ab270f9cad4faea12e5ae9ee29dbc3cacb8ee9eafbc16fc85706b095",
    ),
    file(
        "moss_tts_decode_step.onnx",
        VOICE_MODELS,
        489_413,
        "854d6d905f230e58b03fd12ca9a930d852086db231d10c00d21fb66f8a567aee",
    ),
    file(
        "moss_tts_global_shared_int8.data",
        VOICE_MODELS,
        110_512_128,
        "b127207a2274826b113fd3f2c4917ef366535c3324dd0f8fe95d6355626a85bb",
    ),
    file(
        "moss_tts_local_fixed_sampled_frame.onnx",
        VOICE_MODELS,
        744_178,
        "3baf66aac8bb52e4d7adc9204299a4947788b100efdd07af198f117a59f120a6",
    ),
    file(
        "moss_tts_local_fixed_sampled_frame_int8.data",
        VOICE_MODELS,
        84_974_592,
        "dbbdde4c10bf59e7d63087c6688ca18bad46088d5e4c8c0b7d9e858304d44aa4",
    ),
    file(
        "moss_audio_tokenizer_decode_full.onnx",
        VOICE_CODEC,
        681_902,
        "0fbbafe3fd4afa2a019af5c5ced204af6e2d1db044fa40f021525d2aee95b4ac",
    ),
    file(
        "moss_audio_tokenizer_decode_shared.data",
        VOICE_CODEC,
        44_198_912,
        "e69d52e0f4e84ca27850557ee54face46632d3a5a16c89bd246c7c408466dcad",
    ),
];

const TRANSLATOR_FILES: [ModelFile; 5] = [
    file(
        "source.spm",
        TRANSLATOR,
        804_677,
        "e27a3a1b539f4959ec72ea60e453f49156289f95d4e6000b29332efc45616203",
    ),
    file(
        "vocab.json",
        TRANSLATOR,
        1_747_906,
        "08a119a1defd522fa047cb5e3bfe3e89633e96caa38ced0dc9cee7ef1021a011",
    ),
    file(
        "encoder_model_quantized.onnx",
        TRANSLATOR_GRAPHS,
        52_899_742,
        "84d5e171b626bc8b6b220d022ac58696e9528c25deeacca62b5cbf4364547a99",
    ),
    file(
        "decoder_model_quantized.onnx",
        TRANSLATOR_GRAPHS,
        59_842_102,
        "debcc3054b9ff9aaed972bd6e251a459abe1e2f1402da1efa63163dc2f46ef73",
    ),
    file(
        "decoder_with_past_model_quantized.onnx",
        TRANSLATOR_GRAPHS,
        56_570_638,
        "fbc484152fad41788c729d184058261b2a55d84eed270efa59f0ece477494e00",
    ),
];

impl Model {
    pub const ALL: [Model; 2] = [Model::Voice, Model::Translator];

    pub fn files(self) -> &'static [ModelFile] {
        match self {
            Model::Voice => &VOICE_FILES,
            Model::Translator => &TRANSLATOR_FILES,
        }
    }

    /// Names the revision, so a newer one downloads beside the old, which `tidy` drops.
    fn folder(self) -> &'static str {
        match self {
            Model::Voice => "moss-tts-nano-int8-23fd1979",
            Model::Translator => "opus-mt-zh-en-39d480d5",
        }
    }

    pub fn bytes(self) -> u64 {
        self.files().iter().map(|file| file.bytes).sum()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub model: Model,
    /// The whole download's size.
    pub bytes: u64,
    pub downloaded: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    /// Bytes on disk so far, counting what an earlier attempt left.
    pub downloaded: u64,
    pub total: u64,
}

pub struct Models {
    root: PathBuf,
}

impl Models {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    /// Where `model`'s files are, once `is_downloaded`.
    pub fn dir(&self, model: Model) -> PathBuf {
        self.root.join(model.folder())
    }

    pub fn is_downloaded(&self, model: Model) -> bool {
        let dir = self.dir(model);
        model.files().iter().all(|file| {
            fs::metadata(dir.join(file.name)).is_ok_and(|metadata| metadata.len() == file.bytes)
        })
    }

    pub fn statuses(&self) -> Vec<ModelStatus> {
        Model::ALL
            .into_iter()
            .map(|model| ModelStatus {
                model,
                bytes: model.bytes(),
                downloaded: self.is_downloaded(model),
            })
            .collect()
    }

    /// Downloads whatever `model` still lacks. Returns false when `cancelled`
    /// stopped it; what arrived so far stays for the next attempt.
    pub fn download(
        &self,
        model: Model,
        cancelled: &AtomicBool,
        mut progress: impl FnMut(DownloadProgress),
    ) -> Result<bool> {
        let dir = self.dir(model);
        fs::create_dir_all(&dir)?;
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_connect(Some(Duration::from_secs(20)))
            .timeout_recv_response(Some(Duration::from_secs(30)))
            .build()
            .into();
        let total = model.bytes();
        let mut done: u64 = model
            .files()
            .iter()
            .map(|file| on_disk(&dir, file).min(file.bytes))
            .sum();
        progress(DownloadProgress {
            downloaded: done,
            total,
        });
        let mut reported = done;
        for file in model.files() {
            let target = dir.join(file.name);
            if target.is_file() {
                continue;
            }
            let part = part_path(&dir, file);
            let others = done - on_disk(&dir, file).min(file.bytes);
            let finished = fetch(&agent, file, &part, cancelled, |now| {
                done = others + now.min(file.bytes);
                if done.abs_diff(reported) >= PROGRESS_STEP {
                    reported = done;
                    progress(DownloadProgress {
                        downloaded: done,
                        total,
                    });
                }
            })?;
            if !finished {
                return Ok(false);
            }
            if sha256(&part)? != file.sha256 {
                fs::remove_file(&part)?;
                return Err(Error::Download(format!(
                    "{} arrived damaged; try again",
                    file.name
                )));
            }
            fs::rename(&part, &target)?;
        }
        progress(DownloadProgress {
            downloaded: total,
            total,
        });
        Ok(true)
    }

    pub fn delete(&self, model: Model) -> Result<()> {
        match fs::remove_dir_all(self.dir(model)) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error.into()),
            _ => Ok(()),
        }
    }

    /// Drops the folders of revisions no longer used.
    pub fn tidy(&self) -> Result<()> {
        let Ok(entries) = fs::read_dir(&self.root) else {
            return Ok(());
        };
        for entry in entries {
            let entry = entry?;
            let current = Model::ALL
                .iter()
                .any(|model| entry.file_name() == model.folder());
            if !current {
                fs::remove_dir_all(entry.path())?;
            }
        }
        Ok(())
    }
}

fn part_path(dir: &Path, file: &ModelFile) -> PathBuf {
    dir.join(format!("{}.part", file.name))
}

/// Bytes of `file` on disk, finished or not.
fn on_disk(dir: &Path, file: &ModelFile) -> u64 {
    if dir.join(file.name).is_file() {
        return file.bytes;
    }
    fs::metadata(part_path(dir, file)).map_or(0, |metadata| metadata.len())
}

/// Appends the rest of `file` to `part`, reporting its length as it grows.
/// Returns false when cancelled.
fn fetch(
    agent: &ureq::Agent,
    file: &ModelFile,
    part: &Path,
    cancelled: &AtomicBool,
    mut grown: impl FnMut(u64),
) -> Result<bool> {
    let mut have = fs::metadata(part).map_or(0, |metadata| metadata.len());
    if have > file.bytes {
        fs::remove_file(part)?;
        have = 0;
    }
    if have == file.bytes {
        return Ok(true);
    }
    let url = format!("{}/{}", file.url, file.name);
    let mut response = agent
        .get(&url)
        .header("Range", format!("bytes={have}-"))
        .call()
        .map_err(|error| Error::Download(error.to_string()))?;
    // A server that ignores the range sends the whole file again.
    let resumed = response.status() == 206;
    let mut out = if resumed {
        OpenOptions::new().create(true).append(true).open(part)?
    } else {
        have = 0;
        File::create(part)?
    };
    let mut body = response.body_mut().as_reader();
    let mut buffer = vec![0; CHUNK];
    loop {
        if cancelled.load(Ordering::Relaxed) {
            return Ok(false);
        }
        let read = body
            .read(&mut buffer)
            .map_err(|error| Error::Download(error.to_string()))?;
        if read == 0 {
            break;
        }
        out.write_all(&buffer[..read])?;
        have += read as u64;
        grown(have);
    }
    out.flush()?;
    if have != file.bytes {
        return Err(Error::Download(format!(
            "{} stopped after {have} of {} bytes",
            file.name, file.bytes
        )));
    }
    Ok(true)
}

fn sha256(path: &Path) -> Result<String> {
    let mut hasher = Sha256::new();
    io::copy(&mut File::open(path)?, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// The real models, downloaded once into `target/models` for the tests that need them.
#[cfg(test)]
pub(crate) fn downloaded(model: Model) -> PathBuf {
    let models = Models::new(Path::new(env!("CARGO_MANIFEST_DIR")).join("../target/models"));
    if !models.is_downloaded(model) {
        assert!(
            models
                .download(model, &AtomicBool::new(false), |_| {})
                .unwrap()
        );
    }
    models.dir(model)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_what_each_loader_reads() {
        let names = |model: Model| -> Vec<&str> {
            let mut names: Vec<&str> = model.files().iter().map(|file| file.name).collect();
            names.sort_unstable();
            names
        };
        let mut voice = crate::speech::FILES.to_vec();
        voice.sort_unstable();
        let mut translator = crate::translation::FILES.to_vec();
        translator.sort_unstable();
        assert_eq!(names(Model::Voice), voice);
        assert_eq!(names(Model::Translator), translator);
    }

    #[test]
    fn counts_a_model_downloaded_only_when_every_file_is_whole() {
        let root = tempfile::tempdir().unwrap();
        let models = Models::new(root.path().to_owned());
        let dir = models.dir(Model::Translator);
        fs::create_dir_all(&dir).unwrap();
        for file in &TRANSLATOR_FILES[..4] {
            File::create(dir.join(file.name))
                .unwrap()
                .set_len(file.bytes)
                .unwrap();
        }
        assert!(!models.is_downloaded(Model::Translator));

        let last = &TRANSLATOR_FILES[4];
        File::create(dir.join(last.name))
            .unwrap()
            .set_len(last.bytes)
            .unwrap();
        assert!(models.is_downloaded(Model::Translator));

        models.delete(Model::Translator).unwrap();
        assert!(!models.is_downloaded(Model::Translator));
        models.delete(Model::Translator).unwrap();
    }

    #[test]
    fn drops_folders_of_old_revisions() {
        let root = tempfile::tempdir().unwrap();
        let models = Models::new(root.path().to_owned());
        fs::create_dir_all(models.dir(Model::Voice)).unwrap();
        fs::create_dir_all(root.path().join("moss-tts-nano-int8-old")).unwrap();

        models.tidy().unwrap();

        assert!(models.dir(Model::Voice).is_dir());
        assert!(!root.path().join("moss-tts-nano-int8-old").exists());
    }

    #[test]
    fn serializes_with_the_frontend_field_names() {
        let status = serde_json::to_value(ModelStatus {
            model: Model::Translator,
            bytes: 5,
            downloaded: false,
        })
        .unwrap();
        assert_eq!(
            status,
            serde_json::json!({ "model": "translator", "bytes": 5, "downloaded": false })
        );
        let progress = serde_json::to_value(DownloadProgress {
            downloaded: 1,
            total: 2,
        })
        .unwrap();
        assert_eq!(progress, serde_json::json!({ "downloaded": 1, "total": 2 }));
    }
}
