use std::collections::HashMap;
use std::fs::File;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, OnceLock};

use chrono::Utc;
use serde::{Serialize, Serializer};
use tauri::ipc::{Channel, Response};
use tauri::{AppHandle, Manager};
use vocab_core::dictionary::Script;
use vocab_core::service::{
    self, Deck, ImportStage, Language, ReaderSection, ReviewQueue, StudyCard, WordEntry,
};
use vocab_core::speech::{SpeechCache, Voice};
use vocab_core::statistics::{self, Statistics};
use vocab_core::store::{
    DocumentSummary, Folder, ReviewSnapshot, Store, WordCounts, WordSnapshot, WordStatus,
};
use vocab_core::text::parse_word_list;

use crate::picked_file::PickedFile;
use crate::resources::{DICTIONARY, Resources, VOICE};

/// Reaches the frontend as the rejected `invoke` promise's message.
#[derive(Debug)]
pub struct CommandError(String);

impl Serialize for CommandError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0)
    }
}

impl From<vocab_core::error::Error> for CommandError {
    fn from(error: vocab_core::error::Error) -> Self {
        Self(error.to_string())
    }
}

type CommandResult<T> = Result<T, CommandError>;

pub struct AppState {
    /// Every write goes through this connection.
    writer: Mutex<Store>,
    /// Queries go through this one, so they do not wait for a write to finish.
    reader: Mutex<Store>,
    resources: Resources,
    language: OnceLock<Result<Language, String>>,
    voice: OnceLock<Result<Voice, String>>,
    speech: SpeechCache,
}

impl AppState {
    pub fn new(
        writer: Store,
        reader: Store,
        resources: Resources,
        speech_cache_dir: PathBuf,
    ) -> Self {
        Self {
            writer: Mutex::new(writer),
            reader: Mutex::new(reader),
            resources,
            language: OnceLock::new(),
            voice: OnceLock::new(),
            speech: SpeechCache::new(&speech_cache_dir),
        }
    }

    fn writer(&self) -> CommandResult<MutexGuard<'_, Store>> {
        lock(&self.writer)
    }

    fn reader(&self) -> CommandResult<MutexGuard<'_, Store>> {
        lock(&self.reader)
    }

    /// Loads CC-CEDICT and jieba once; later callers wait for the first load.
    pub fn language(&self) -> CommandResult<&Language> {
        self.language
            .get_or_init(|| {
                let dir = self.resources.dir()?;
                File::open(dir.join(DICTIONARY))
                    .map_err(|error| format!("Could not open the dictionary: {error}"))
                    .and_then(|file| Language::load(file).map_err(|error| error.to_string()))
            })
            .as_ref()
            .map_err(|message| CommandError(message.clone()))
    }

    /// Loads the text-to-speech voice once, on the first word spoken.
    fn voice(&self) -> CommandResult<&Voice> {
        self.voice
            .get_or_init(|| {
                let dir = self.resources.dir()?;
                Voice::load(&dir.join(VOICE)).map_err(|error| error.to_string())
            })
            .as_ref()
            .map_err(|message| CommandError(message.clone()))
    }
}

fn lock(store: &Mutex<Store>) -> CommandResult<MutexGuard<'_, Store>> {
    store
        .lock()
        .map_err(|_| CommandError("The database is unavailable after an earlier failure".into()))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownWordsImport {
    pub found: u32,
    pub added: u32,
}

/// Runs `work` on a thread meant for blocking, keeping database and CPU work
/// off the async runtime that serves every command.
///
/// Each store guard is taken inside one statement, so it is released before
/// the dictionary or jieba work that follows.
async fn blocking<T: Send + 'static>(
    app: AppHandle,
    work: impl FnOnce(&AppState) -> CommandResult<T> + Send + 'static,
) -> CommandResult<T> {
    tauri::async_runtime::spawn_blocking(move || work(&app.state::<AppState>()))
        .await
        .map_err(|error| CommandError(error.to_string()))?
}

#[tauri::command]
pub async fn list_documents(app: AppHandle) -> CommandResult<Vec<DocumentSummary>> {
    blocking(app, |state| Ok(state.reader()?.documents()?)).await
}

#[tauri::command]
pub async fn import_document(
    app: AppHandle,
    path: String,
    on_progress: Channel<ImportStage>,
) -> CommandResult<DocumentSummary> {
    let handle = app.clone();
    blocking(app, move |state| {
        let report = |stage| {
            let _ = on_progress.send(stage);
        };
        let picked = PickedFile::open(&handle, &path)
            .map_err(|error| CommandError(format!("Could not open the file: {error}")))?;
        // Checked before the slow analysis; `save_file` checks again in its transaction.
        let content_hash = service::content_hash(picked.path())?;
        state.reader()?.ensure_not_imported(&content_hash)?;
        let file = service::analyze_file(picked.path(), content_hash, state.language()?, report)?;
        report(ImportStage::Saving);
        Ok(service::save_file(
            &mut *state.writer()?,
            &file,
            Utc::now(),
        )?)
    })
    .await
}

#[tauri::command]
pub async fn delete_document(app: AppHandle, id: i64) -> CommandResult<()> {
    blocking(app, move |state| Ok(state.writer()?.delete_document(id)?)).await
}

#[tauri::command]
pub async fn list_folders(app: AppHandle) -> CommandResult<Vec<Folder>> {
    blocking(app, |state| Ok(state.reader()?.folders()?)).await
}

#[tauri::command]
pub async fn create_folder(
    app: AppHandle,
    name: String,
    document_ids: Vec<i64>,
) -> CommandResult<Folder> {
    blocking(app, move |state| {
        Ok(state
            .writer()?
            .create_folder(&name, &document_ids, Utc::now())?)
    })
    .await
}

#[tauri::command]
pub async fn rename_folder(app: AppHandle, id: i64, name: String) -> CommandResult<()> {
    blocking(app, move |state| {
        Ok(state.writer()?.rename_folder(id, &name)?)
    })
    .await
}

/// `folder_id: None` takes the book out of its folder.
#[tauri::command]
pub async fn move_document(
    app: AppHandle,
    document_id: i64,
    folder_id: Option<i64>,
) -> CommandResult<()> {
    blocking(app, move |state| {
        Ok(state.writer()?.move_document(document_id, folder_id)?)
    })
    .await
}

/// The cover as a `data:` URL; `None` for a book without one.
#[tauri::command]
pub async fn get_cover(app: AppHandle, document_id: i64) -> CommandResult<Option<String>> {
    blocking(app, move |state| {
        let cover = state.reader()?.cover(document_id)?;
        Ok(cover.map(|cover| cover.data_url()))
    })
    .await
}

#[tauri::command]
pub async fn get_deck(
    app: AppHandle,
    document_id: i64,
    limit: u32,
    script: Script,
) -> CommandResult<Deck> {
    blocking(app, move |state| {
        let source = service::deck_source(&*state.reader()?, document_id, limit)?;
        Ok(service::deck(source, &state.language()?.dictionary, script))
    })
    .await
}

/// Each section's title in reading order; `None` for an untitled one.
#[tauri::command]
pub async fn list_sections(
    app: AppHandle,
    document_id: i64,
    script: Script,
) -> CommandResult<Vec<Option<String>>> {
    blocking(app, move |state| {
        let titles = state.reader()?.section_titles(document_id)?;
        Ok(service::section_titles(
            titles,
            &state.language()?.dictionary,
            script,
        ))
    })
    .await
}

#[tauri::command]
pub async fn get_section(
    app: AppHandle,
    document_id: i64,
    position: u32,
    script: Script,
) -> CommandResult<ReaderSection> {
    blocking(app, move |state| {
        let section = state.reader()?.section(document_id, position)?;
        Ok(service::reader_section(
            section,
            state.language()?,
            position,
            script,
        ))
    })
    .await
}

#[tauri::command]
pub async fn set_reading_position(
    app: AppHandle,
    document_id: i64,
    section: u32,
    paragraph: u32,
) -> CommandResult<()> {
    blocking(app, move |state| {
        Ok(state
            .writer()?
            .set_reading_position(document_id, section, paragraph)?)
    })
    .await
}

/// The status of each known or learning word among `words`; unseen words are left out.
#[tauri::command]
pub async fn get_word_statuses(
    app: AppHandle,
    words: Vec<String>,
) -> CommandResult<HashMap<String, WordStatus>> {
    blocking(app, move |state| Ok(state.reader()?.statuses(&words)?)).await
}

#[tauri::command]
pub async fn get_word_card(
    app: AppHandle,
    word: String,
    script: Script,
) -> CommandResult<StudyCard> {
    blocking(app, move |state| {
        let example = state.reader()?.example_for(&word)?;
        Ok(service::word_card(
            &state.language()?.dictionary,
            word,
            example,
            script,
        ))
    })
    .await
}

/// Marks the words known; returns how many were not known before.
#[tauri::command]
pub async fn mark_words_known(app: AppHandle, words: Vec<String>) -> CommandResult<u32> {
    blocking(app, move |state| {
        Ok(state.writer()?.import_known(&words, Utc::now())?)
    })
    .await
}

#[tauri::command]
pub async fn set_word_status(
    app: AppHandle,
    word: String,
    status: WordStatus,
) -> CommandResult<WordSnapshot> {
    blocking(app, move |state| {
        Ok(state.writer()?.set_status(&word, status, Utc::now())?)
    })
    .await
}

#[tauri::command]
pub async fn restore_word(app: AppHandle, snapshot: WordSnapshot) -> CommandResult<()> {
    blocking(app, move |state| Ok(state.writer()?.restore(&snapshot)?)).await
}

#[tauri::command]
pub async fn get_review_queue(
    app: AppHandle,
    limit: u32,
    script: Script,
) -> CommandResult<ReviewQueue> {
    blocking(app, move |state| {
        let source = service::review_source(&*state.reader()?, Utc::now(), limit)?;
        Ok(service::review_queue(
            source,
            &state.language()?.dictionary,
            script,
        ))
    })
    .await
}

#[tauri::command]
pub async fn review_word(
    app: AppHandle,
    word: String,
    rating: u8,
) -> CommandResult<ReviewSnapshot> {
    blocking(app, move |state| {
        Ok(state.writer()?.review(&word, rating, Utc::now())?.snapshot)
    })
    .await
}

#[tauri::command]
pub async fn undo_review(app: AppHandle, snapshot: ReviewSnapshot) -> CommandResult<()> {
    blocking(app, move |state| {
        Ok(state.writer()?.undo_review(&snapshot)?)
    })
    .await
}

#[tauri::command]
pub async fn import_known_words(app: AppHandle, text: String) -> CommandResult<KnownWordsImport> {
    blocking(app, move |state| {
        let words = parse_word_list(&text);
        let added = state.writer()?.import_known(&words, Utc::now())?;
        Ok(KnownWordsImport {
            found: words.len() as u32,
            added,
        })
    })
    .await
}

/// Every known or learning word, most recently changed first.
#[tauri::command]
pub async fn list_words(app: AppHandle, script: Script) -> CommandResult<Vec<WordEntry>> {
    blocking(app, move |state| {
        let words = state.reader()?.tracked_words()?;
        Ok(service::word_list(
            words,
            &state.language()?.dictionary,
            script,
        ))
    })
    .await
}

#[tauri::command]
pub async fn get_word_counts(app: AppHandle) -> CommandResult<WordCounts> {
    blocking(app, |state| Ok(state.reader()?.counts(Utc::now())?)).await
}

/// Review history, due forecast and memory stability over the `days` days ending today.
#[tauri::command]
pub async fn get_statistics(app: AppHandle, days: u32) -> CommandResult<Statistics> {
    blocking(app, move |state| {
        let now = Utc::now().with_timezone(&chrono::Local);
        Ok(state
            .reader()?
            .snapshot(|store| statistics::statistics(store, now, days))?)
    })
    .await
}

/// A word or phrase spoken aloud, as Ogg Opus bytes (an `ArrayBuffer` in the frontend).
/// Saved audio is reused; the voice loads only for text not yet spoken.
#[tauri::command]
pub async fn speak(app: AppHandle, text: String) -> CommandResult<Response> {
    blocking(app, move |state| {
        let audio = state.speech.get_or_speak(&text, |text| {
            state
                .voice()
                .map_err(|CommandError(message)| vocab_core::error::Error::Voice(message))?
                .speak(text)
        })?;
        Ok(Response::new(audio))
    })
    .await
}
