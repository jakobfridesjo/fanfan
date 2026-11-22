use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Mutex, PoisonError};
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
/// Most phrases a job speaks at once. Each runs on a thread of its own; past
/// four, the cores fight over memory and gain little.
const MAX_WORKERS: usize = 4;

/// How many phrases a job speaks at once: half the logical cores, leaving the
/// rest to the app and to words spoken meanwhile, and at most `MAX_WORKERS`.
pub fn workers() -> usize {
    let cores = thread::available_parallelism().map_or(1, |cores| cores.get());
    (cores / 2).clamp(1, MAX_WORKERS)
}

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
    /// How many phrases to speak at once, each on a thread of its own.
    pub workers: usize,
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
    /// each as it goes, so a stopped job carries on where it left off. Speaks
    /// `job.workers` phrases at once. Resolves to false when cancelled.
    pub fn prepare(
        &self,
        job: &PrepareJob,
        mut phrases_of: impl FnMut(u32) -> Result<Vec<String>>,
        speak: impl Fn(&str) -> Result<Vec<u8>> + Sync,
        report: impl FnMut(PrepareProgress) + Send,
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
        let reporter = Reporter::new(report);
        for (sections_done, section) in (job.from..=job.to).enumerate() {
            let marker = folder.join(PREPARED).join(section.to_string());
            if marker.exists() {
                continue;
            }
            let phrases = phrases_of(section)?;
            let mut seen = HashSet::new();
            let distinct: Vec<&str> = phrases
                .iter()
                .map(String::as_str)
                .filter(|phrase| seen.insert(*phrase))
                .collect();
            let unsaved: Vec<&str> = distinct
                .iter()
                .copied()
                .filter(|phrase| !folder.join(clip_name(phrase)).exists())
                .collect();
            reporter.start(PrepareProgress {
                section,
                sections_done: sections_done as u32,
                sections_total,
                phrases_done: (distinct.len() - unsaved.len()) as u32,
                phrases_total: distinct.len() as u32,
                waiting: false,
            });
            let next = AtomicUsize::new(0);
            let saved = AtomicUsize::new(0);
            let failed = AtomicBool::new(false);
            let stopped =
                || failed.load(Ordering::Relaxed) || job.cancelled.load(Ordering::Relaxed);
            let work = || -> Result<()> {
                while !stopped() {
                    let Some(phrase) = unsaved.get(next.fetch_add(1, Ordering::Relaxed)) else {
                        break;
                    };
                    while job.live.load(Ordering::Acquire) > 0 && !stopped() {
                        reporter.wait();
                        thread::sleep(WAIT);
                    }
                    if stopped() {
                        break;
                    }
                    let path = folder.join(clip_name(phrase));
                    speak(phrase)
                        .and_then(|audio| Ok(write_whole(&path, &audio)?))
                        .inspect_err(|_| failed.store(true, Ordering::Relaxed))?;
                    saved.fetch_add(1, Ordering::Relaxed);
                    reporter.phrase_done();
                }
                Ok(())
            };
            let workers = job.workers.clamp(1, unsaved.len().max(1));
            thread::scope(|scope| {
                let running: Vec<_> = (0..workers).map(|_| scope.spawn(work)).collect();
                running
                    .into_iter()
                    .map(|worker| {
                        worker
                            .join()
                            .unwrap_or_else(|panic| std::panic::resume_unwind(panic))
                    })
                    .collect::<Result<Vec<()>>>()
            })?;
            if saved.into_inner() == unsaved.len() {
                write_whole(&marker, &[])?;
            }
            if job.cancelled.load(Ordering::Relaxed) {
                return Ok(false);
            }
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

/// Reports a job's progress from whichever worker moves it on.
struct Reporter<R> {
    state: Mutex<(PrepareProgress, R)>,
}

impl<R: FnMut(PrepareProgress)> Reporter<R> {
    fn new(report: R) -> Self {
        let progress = PrepareProgress {
            section: 0,
            sections_done: 0,
            sections_total: 0,
            phrases_done: 0,
            phrases_total: 0,
            waiting: false,
        };
        Self {
            state: Mutex::new((progress, report)),
        }
    }

    fn update(&self, change: impl FnOnce(&mut PrepareProgress) -> bool) {
        let mut state = self.state.lock().unwrap_or_else(PoisonError::into_inner);
        let (progress, report) = &mut *state;
        if change(progress) {
            report(*progress);
        }
    }

    fn start(&self, progress: PrepareProgress) {
        self.update(|current| {
            *current = progress;
            true
        });
    }

    /// Reports waiting for live speech, once until the next phrase is done.
    fn wait(&self) {
        self.update(|progress| !std::mem::replace(&mut progress.waiting, true));
    }

    fn phrase_done(&self) {
        self.update(|progress| {
            progress.phrases_done += 1;
            progress.waiting = false;
            true
        });
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
            workers: 1,
            cancelled,
            live,
        }
    }

    #[test]
    fn prepares_each_phrase_once_and_finds_it_by_its_text() {
        let root = tempfile::tempdir().unwrap();
        let audio = BookAudio::new(root.path());
        let (cancelled, live) = (AtomicBool::new(false), AtomicUsize::new(0));
        let spoken = Mutex::new(Vec::new());
        let mut reports = Vec::new();

        let finished = audio
            .prepare(
                &job(&cancelled, &live),
                |section| Ok(sections()[section as usize].clone()),
                |text| {
                    spoken.lock().unwrap().push(text.to_owned());
                    Ok(text.as_bytes().to_vec())
                },
                |progress| reports.push(progress),
            )
            .unwrap();

        assert!(finished);
        assert_eq!(
            *spoken.lock().unwrap(),
            ["第一句。", "第二句。", "第三句。"]
        );
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
        let spoken = AtomicUsize::new(0);
        let speak = |text: &str| {
            if spoken.fetch_add(1, Ordering::Relaxed) == 1 {
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
        assert_eq!(audio.list().unwrap()[0].sections, [0]);

        cancelled.store(false, Ordering::Relaxed);
        let again = Mutex::new(Vec::new());
        audio
            .prepare(
                &job(&cancelled, &live),
                |section| Ok(sections()[section as usize].clone()),
                |text| {
                    again.lock().unwrap().push(text.to_owned());
                    Ok(Vec::new())
                },
                |_| {},
            )
            .unwrap();
        assert_eq!(*again.lock().unwrap(), ["第三句。"]);
    }

    #[test]
    fn speaks_phrases_on_several_workers_once_each() {
        let root = tempfile::tempdir().unwrap();
        let audio = BookAudio::new(root.path());
        let (cancelled, live) = (AtomicBool::new(false), AtomicUsize::new(0));
        let phrases: Vec<String> = (0..20).map(|n| format!("第{n}句。")).collect();
        let spoken = Mutex::new(Vec::new());
        let mut last = None;
        let job = PrepareJob {
            to: 0,
            workers: 3,
            ..job(&cancelled, &live)
        };

        let finished = audio
            .prepare(
                &job,
                |_| Ok(phrases.clone()),
                |text| {
                    thread::sleep(Duration::from_millis(5));
                    spoken.lock().unwrap().push(text.to_owned());
                    Ok(text.as_bytes().to_vec())
                },
                |progress| last = Some(progress),
            )
            .unwrap();

        assert!(finished);
        let mut spoken = spoken.into_inner().unwrap();
        spoken.sort();
        let mut expected = phrases.clone();
        expected.sort();
        assert_eq!(spoken, expected);
        assert!(
            phrases
                .iter()
                .all(|phrase| audio.find(phrase, Speaker::Weiguo).is_some())
        );
        let last = last.unwrap();
        assert_eq!((last.phrases_done, last.phrases_total), (20, 20));
    }

    #[test]
    fn stops_every_worker_when_one_fails() {
        let root = tempfile::tempdir().unwrap();
        let audio = BookAudio::new(root.path());
        let (cancelled, live) = (AtomicBool::new(false), AtomicUsize::new(0));
        let phrases: Vec<String> = (0..20).map(|n| format!("第{n}句。")).collect();
        let spoken = AtomicUsize::new(0);
        let job = PrepareJob {
            to: 0,
            workers: 3,
            ..job(&cancelled, &live)
        };

        let result = audio.prepare(
            &job,
            |_| Ok(phrases.clone()),
            |_| {
                if spoken.fetch_add(1, Ordering::Relaxed) == 2 {
                    return Err(Error::Voice("broken".into()));
                }
                thread::sleep(Duration::from_millis(5));
                Ok(Vec::new())
            },
            |_| {},
        );

        assert!(result.is_err());
        assert!(spoken.load(Ordering::Relaxed) < 20);
        assert!(audio.list().unwrap()[0].sections.is_empty());
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
