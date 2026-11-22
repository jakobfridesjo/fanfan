use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::speech::{MODEL_ID, Speaker, clip_name, write_whole};

/// Asked for chapters, kept in each voice's folder.
const RANGE: &str = "range.json";
/// Holds an empty file named after each section whose every phrase is saved.
const PREPARED: &str = "prepared";
/// How often a job waiting for live speech checks again.
const WAIT: Duration = Duration::from_millis(50);

/// What is prepared of one book in one voice.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedAudio {
    pub document_id: i64,
    pub speaker: Speaker,
    /// The first and last section asked for, by position.
    pub from: u32,
    pub to: u32,
    /// The sections whose every phrase is saved, in order.
    pub sections: Vec<u32>,
    pub bytes: u64,
}

/// How far a `BookAudio::prepare` has come.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareProgress {
    /// The section being prepared, by position.
    pub section: u32,
    pub sections_done: u32,
    pub sections_total: u32,
    /// Phrases of `section` saved so far, out of `phrases_total`.
    pub phrases_done: u32,
    pub phrases_total: u32,
    /// Waiting while words or read-aloud are spoken live.
    pub waiting: bool,
}

/// What to prepare, and the signals that pause or stop it.
pub struct PrepareJob<'a> {
    pub document_id: i64,
    pub speaker: Speaker,
    pub from: u32,
    pub to: u32,
    /// Set to stop before the next phrase.
    pub cancelled: &'a AtomicBool,
    /// Speech requests running now, which go first: the job waits while any runs.
    pub live: &'a AtomicUsize,
}

#[derive(Serialize, Deserialize)]
struct Range {
    from: u32,
    to: u32,
}

/// Books read aloud ahead of time, as `<document id>/<speaker>/<clip>.opus`, kept
/// until deleted rather than tidied like the speech cache. Clips are named as
/// the cache names them, so a phrase is found by its text.
pub struct BookAudio {
    root: PathBuf,
    dir: PathBuf,
}

impl BookAudio {
    /// Keeps audio under `root/MODEL_ID`.
    pub fn new(root: &Path) -> Self {
        Self {
            root: root.to_path_buf(),
            dir: root.join(MODEL_ID),
        }
    }

    /// `text` in `speaker`'s voice from any book that has it prepared.
    pub fn find(&self, text: &str, speaker: Speaker) -> Option<Vec<u8>> {
        let name = clip_name(text);
        fs::read_dir(&self.dir)
            .ok()?
            .flatten()
            .find_map(|book| fs::read(book.path().join(speaker.name()).join(&name)).ok())
    }

    /// Speaks every phrase of sections `from..=to` that is not saved yet, saving
    /// each as it goes, so a stopped job carries on where it left off. Resolves
    /// to false when cancelled.
    pub fn prepare(
        &self,
        job: &PrepareJob,
        mut phrases_of: impl FnMut(u32) -> Result<Vec<String>>,
        mut speak: impl FnMut(&str) -> Result<Vec<u8>>,
        mut report: impl FnMut(PrepareProgress),
    ) -> Result<bool> {
        if job.from > job.to {
            return Err(Error::BookAudio(format!(
                "section {} comes after section {}",
                job.from + 1,
                job.to + 1
            )));
        }
        let folder = self.folder(job.document_id, job.speaker);
        self.widen_range(&folder, job.from, job.to)?;
        let sections_total = job.to - job.from + 1;
        for (sections_done, section) in (job.from..=job.to).enumerate() {
            let marker = folder.join(PREPARED).join(section.to_string());
            if marker.exists() {
                continue;
            }
            let phrases = phrases_of(section)?;
            let mut progress = PrepareProgress {
                section,
                sections_done: sections_done as u32,
                sections_total,
                phrases_done: 0,
                phrases_total: phrases.len() as u32,
                waiting: false,
            };
            report(progress);
            for phrase in &phrases {
                let path = folder.join(clip_name(phrase));
                if !path.exists() {
                    while job.live.load(Ordering::Acquire) > 0 {
                        if job.cancelled.load(Ordering::Relaxed) {
                            return Ok(false);
                        }
                        if !progress.waiting {
                            progress.waiting = true;
                            report(progress);
                        }
                        thread::sleep(WAIT);
                    }
                    progress.waiting = false;
                    if job.cancelled.load(Ordering::Relaxed) {
                        return Ok(false);
                    }
                    write_whole(&path, &speak(phrase)?)?;
                }
                progress.phrases_done += 1;
                report(progress);
            }
            write_whole(&marker, &[])?;
        }
        Ok(true)
    }

    /// Every book and voice with audio prepared, by document id.
    pub fn list(&self) -> Result<Vec<PreparedAudio>> {
        let mut prepared = Vec::new();
        for book in read_dir(&self.dir)? {
            let Some(document_id) = file_name(&book).and_then(|name| name.parse().ok()) else {
                continue;
            };
            for voice in read_dir(&book)? {
                let Some(speaker) = file_name(&voice).and_then(Speaker::from_name) else {
                    continue;
                };
                let Ok(range) = fs::read(voice.join(RANGE)) else {
                    continue;
                };
                let range: Range = serde_json::from_slice(&range)?;
                let mut sections: Vec<u32> = read_dir(&voice.join(PREPARED))?
                    .iter()
                    .filter_map(|marker| file_name(marker)?.parse().ok())
                    .collect();
                sections.sort_unstable();
                prepared.push(PreparedAudio {
                    document_id,
                    speaker,
                    from: range.from,
                    to: range.to,
                    sections,
                    bytes: size_of(&voice)?,
                });
            }
        }
        prepared.sort_by_key(|audio| (audio.document_id, audio.speaker.name()));
        Ok(prepared)
    }

    /// Deletes a book's audio in `speaker`'s voice, or in every voice.
    pub fn remove(&self, document_id: i64, speaker: Option<Speaker>) -> Result<()> {
        let book = self.dir.join(document_id.to_string());
        let path = match speaker {
            Some(speaker) => book.join(speaker.name()),
            None => book,
        };
        match fs::remove_dir_all(&path) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error.into()),
            _ => Ok(()),
        }
    }

    /// Deletes audio from earlier models and of books no longer in `documents`.
    pub fn tidy(&self, documents: &[i64]) -> Result<()> {
        for entry in read_dir(&self.root)? {
            if file_name(&entry) != Some(MODEL_ID) {
                remove_path(&entry)?;
            }
        }
        for book in read_dir(&self.dir)? {
            let known = file_name(&book)
                .and_then(|name| name.parse::<i64>().ok())
                .is_some_and(|id| documents.contains(&id));
            if !known {
                remove_path(&book)?;
            }
        }
        Ok(())
    }

    fn folder(&self, document_id: i64, speaker: Speaker) -> PathBuf {
        self.dir.join(document_id.to_string()).join(speaker.name())
    }

    /// Records `from..=to` as asked for, together with what was asked before.
    fn widen_range(&self, folder: &Path, from: u32, to: u32) -> Result<()> {
        let range = match fs::read(folder.join(RANGE)) {
            Ok(saved) => {
                let saved: Range = serde_json::from_slice(&saved)?;
                Range {
                    from: saved.from.min(from),
                    to: saved.to.max(to),
                }
            }
            Err(_) => Range { from, to },
        };
        write_whole(&folder.join(RANGE), &serde_json::to_vec(&range)?)?;
        Ok(())
    }
}

/// The entries of `dir`, or none when it does not exist.
fn read_dir(dir: &Path) -> Result<Vec<PathBuf>> {
    match fs::read_dir(dir) {
        Ok(entries) => Ok(entries
            .map(|entry| entry.map(|entry| entry.path()))
            .collect::<std::io::Result<_>>()?),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error.into()),
    }
}

fn file_name(path: &Path) -> Option<&str> {
    path.file_name()?.to_str()
}

fn size_of(dir: &Path) -> Result<u64> {
    let mut total = 0;
    for path in read_dir(dir)? {
        total += if path.is_dir() {
            size_of(&path)?
        } else {
            fs::metadata(&path)?.len()
        };
    }
    Ok(total)
}

fn remove_path(path: &Path) -> std::io::Result<()> {
    if path.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;

    use super::*;

    const BOOK: i64 = 7;

    fn sections() -> Vec<Vec<String>> {
        vec![
            vec!["第一句。".into(), "第二句。".into()],
            vec![],
            vec!["第三句。".into(), "第一句。".into()],
        ]
    }

    fn job<'a>(cancelled: &'a AtomicBool, live: &'a AtomicUsize) -> PrepareJob<'a> {
        PrepareJob {
            document_id: BOOK,
            speaker: Speaker::Weiguo,
            from: 0,
            to: 2,
            cancelled,
            live,
        }
    }

    #[test]
    fn prepares_each_phrase_once_and_finds_it_by_its_text() {
        let root = tempfile::tempdir().unwrap();
        let audio = BookAudio::new(root.path());
        let (cancelled, live) = (AtomicBool::new(false), AtomicUsize::new(0));
        let spoken = RefCell::new(Vec::new());
        let mut reports = Vec::new();

        let finished = audio
            .prepare(
                &job(&cancelled, &live),
                |section| Ok(sections()[section as usize].clone()),
                |text| {
                    spoken.borrow_mut().push(text.to_owned());
                    Ok(text.as_bytes().to_vec())
                },
                |progress| reports.push(progress),
            )
            .unwrap();

        assert!(finished);
        assert_eq!(*spoken.borrow(), ["第一句。", "第二句。", "第三句。"]);
        assert_eq!(
            audio.find("第三句。", Speaker::Weiguo),
            Some("第三句。".as_bytes().to_vec())
        );
        assert_eq!(audio.find("第三句。", Speaker::Lingyu), None);
        assert_eq!(
            reports.last(),
            Some(&PrepareProgress {
                section: 2,
                sections_done: 2,
                sections_total: 3,
                phrases_done: 2,
                phrases_total: 2,
                waiting: false,
            })
        );
        let listed = audio.list().unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].sections, [0, 1, 2]);
        assert_eq!((listed[0].from, listed[0].to), (0, 2));
        assert!(listed[0].bytes > 0);
    }

    #[test]
    fn a_cancelled_job_resumes_without_speaking_again() {
        let root = tempfile::tempdir().unwrap();
        let audio = BookAudio::new(root.path());
        let (cancelled, live) = (AtomicBool::new(false), AtomicUsize::new(0));
        let spoken = RefCell::new(0);
        let speak = |text: &str| {
            *spoken.borrow_mut() += 1;
            if *spoken.borrow() == 2 {
                cancelled.store(true, Ordering::Relaxed);
            }
            Ok(text.as_bytes().to_vec())
        };

        let finished = audio
            .prepare(
                &job(&cancelled, &live),
                |section| Ok(sections()[section as usize].clone()),
                speak,
                |_| {},
            )
            .unwrap();
        assert!(!finished);
        assert_eq!(audio.list().unwrap()[0].sections, [0, 1]);

        cancelled.store(false, Ordering::Relaxed);
        let mut again = Vec::new();
        audio
            .prepare(
                &job(&cancelled, &live),
                |section| Ok(sections()[section as usize].clone()),
                |text| {
                    again.push(text.to_owned());
                    Ok(Vec::new())
                },
                |_| {},
            )
            .unwrap();
        assert_eq!(again, ["第三句。"]);
    }

    #[test]
    fn waits_while_speech_runs_live() {
        let root = tempfile::tempdir().unwrap();
        let audio = BookAudio::new(root.path());
        let (cancelled, live) = (AtomicBool::new(false), AtomicUsize::new(1));
        let mut waited = false;

        let finished = audio
            .prepare(
                &job(&cancelled, &live),
                |section| Ok(sections()[section as usize].clone()),
                |_| Ok(Vec::new()),
                |progress| {
                    if progress.waiting {
                        waited = true;
                        live.store(0, Ordering::Release);
                    }
                },
            )
            .unwrap();
        assert!(finished);
        assert!(waited);
    }

    #[test]
    fn widens_the_range_and_removes_books() {
        let root = tempfile::tempdir().unwrap();
        let audio = BookAudio::new(root.path());
        let (cancelled, live) = (AtomicBool::new(false), AtomicUsize::new(0));
        for (from, to) in [(1, 1), (2, 2)] {
            let job = PrepareJob {
                from,
                to,
                ..job(&cancelled, &live)
            };
            audio
                .prepare(
                    &job,
                    |_| Ok(vec!["句。".into()]),
                    |_| Ok(Vec::new()),
                    |_| {},
                )
                .unwrap();
        }
        let listed = audio.list().unwrap();
        assert_eq!((listed[0].from, listed[0].to), (1, 2));

        audio.remove(BOOK, Some(Speaker::Lingyu)).unwrap();
        assert_eq!(audio.list().unwrap().len(), 1);
        audio.remove(BOOK, None).unwrap();
        assert!(audio.list().unwrap().is_empty());
    }

    #[test]
    fn tidies_away_old_models_and_deleted_books() {
        let root = tempfile::tempdir().unwrap();
        let audio = BookAudio::new(root.path());
        let (cancelled, live) = (AtomicBool::new(false), AtomicUsize::new(0));
        for document_id in [1, 2] {
            let job = PrepareJob {
                document_id,
                ..job(&cancelled, &live)
            };
            audio
                .prepare(
                    &job,
                    |_| Ok(vec!["句。".into()]),
                    |_| Ok(Vec::new()),
                    |_| {},
                )
                .unwrap();
        }
        fs::create_dir_all(root.path().join("old-model/1")).unwrap();

        audio.tidy(&[2]).unwrap();

        assert!(!root.path().join("old-model").exists());
        let books: Vec<i64> = audio
            .list()
            .unwrap()
            .iter()
            .map(|a| a.document_id)
            .collect();
        assert_eq!(books, [2]);
    }

    #[test]
    fn serializes_with_the_frontend_field_names() {
        let prepared = PreparedAudio {
            document_id: 1,
            speaker: Speaker::Lingyu,
            from: 0,
            to: 3,
            sections: vec![0],
            bytes: 10,
        };
        assert_eq!(
            serde_json::to_value(prepared).unwrap(),
            serde_json::json!({
                "documentId": 1, "speaker": "lingyu", "from": 0, "to": 3, "sections": [0], "bytes": 10
            })
        );
        let progress = PrepareProgress {
            section: 1,
            sections_done: 0,
            sections_total: 2,
            phrases_done: 3,
            phrases_total: 4,
            waiting: true,
        };
        assert_eq!(
            serde_json::to_value(progress).unwrap(),
            serde_json::json!({
                "section": 1, "sectionsDone": 0, "sectionsTotal": 2,
                "phrasesDone": 3, "phrasesTotal": 4, "waiting": true
            })
        );
    }
}
