use chrono::{DateTime, Utc};
use rs_fsrs::Card;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};

use super::{Store, WordStatus};
use crate::error::{Error, Result};

/// Bumped whenever the shape of [`Backup`] changes.
const BACKUP_VERSION: u32 = 1;

const APP: &str = "fanfan";

/// Everything the learner made: word statuses with their review schedules, the
/// review history, and per book where they are reading and what they bookmarked.
/// A book's text is left out; its file restores it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub app: String,
    pub version: u32,
    /// Unix milliseconds, like every other time in the backup.
    pub exported_at: i64,
    pub words: Vec<BackupWord>,
    pub reviews: Vec<BackupReview>,
    pub documents: Vec<BackupDocument>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupWord {
    pub word: String,
    pub status: WordStatus,
    /// The FSRS card of a learning word.
    pub card: Option<serde_json::Value>,
    pub due_at: Option<i64>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupReview {
    pub word: String,
    /// 1 (again) to 4 (easy).
    pub rating: u8,
    pub reviewed_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupDocument {
    pub title: String,
    pub file_name: String,
    /// The SHA-256 of the imported file, to match it again.
    pub content_hash: Option<String>,
    pub added_at: i64,
    pub folder: Option<String>,
    pub reading_section: u32,
    pub reading_paragraph: u32,
    pub read_at: Option<i64>,
    pub bookmarks: Vec<BackupBookmark>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupBookmark {
    pub section: u32,
    pub paragraph: u32,
    pub created_at: i64,
}

/// What [`Store::restore_backup`] took from a backup.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupImport {
    /// Words added, or replaced because the backup changed them more recently.
    pub words: u32,
    /// Reviews not already in the history.
    pub reviews: u32,
    /// Books in the library the backup had a reading place for.
    pub documents: u32,
    /// Books in the backup that are not in the library.
    pub missing_documents: u32,
}

impl Store {
    /// Merges a backup into the database, so restoring one twice, or onto a device
    /// with its own progress, loses nothing. A word takes whichever change is newer,
    /// the review history gains the reviews it lacks, and a book already in the
    /// library, matched by its file's hash, gets its bookmarks, its folder if it has
    /// none, and its reading position if the backup's is newer.
    pub fn restore_backup(&mut self, backup: &Backup, now: DateTime<Utc>) -> Result<BackupImport> {
        if backup.app != APP {
            return Err(Error::InvalidBackup(format!(
                "it was made by \"{}\"",
                backup.app
            )));
        }
        if backup.version > BACKUP_VERSION {
            return Err(Error::NewerBackup(backup.version));
        }
        let transaction = self.connection.transaction()?;
        let words = restore_words(&transaction, &backup.words)?;
        let reviews = restore_reviews(&transaction, &backup.reviews)?;
        let (documents, missing_documents) =
            restore_documents(&transaction, &backup.documents, now)?;
        transaction.commit()?;
        Ok(BackupImport {
            words,
            reviews,
            documents,
            missing_documents,
        })
    }

    /// A [`Backup`] of one snapshot of the database.
    pub fn backup(&self, now: DateTime<Utc>) -> Result<Backup> {
        self.snapshot(|store| {
            Ok(Backup {
                app: APP.to_owned(),
                version: BACKUP_VERSION,
                exported_at: now.timestamp_millis(),
                words: store.backup_words()?,
                reviews: store.backup_reviews()?,
                documents: store.backup_documents()?,
            })
        })
    }

    fn backup_words(&self) -> Result<Vec<BackupWord>> {
        let mut statement = self
            .connection
            .prepare("SELECT word, status, card, due_at, updated_at FROM words ORDER BY word")?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    WordStatus::parse(&row.get::<_, String>(1)?)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows.into_iter()
            .map(|(word, status, card, due_at, updated_at)| {
                Ok(BackupWord {
                    word,
                    status,
                    card: card.map(|json| serde_json::from_str(&json)).transpose()?,
                    due_at,
                    updated_at,
                })
            })
            .collect()
    }

    fn backup_reviews(&self) -> Result<Vec<BackupReview>> {
        let mut statement = self
            .connection
            .prepare("SELECT word, rating, reviewed_at FROM reviews ORDER BY reviewed_at, id")?;
        let reviews = statement
            .query_map([], |row| {
                Ok(BackupReview {
                    word: row.get(0)?,
                    rating: row.get(1)?,
                    reviewed_at: row.get(2)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(reviews)
    }

    fn backup_documents(&self) -> Result<Vec<BackupDocument>> {
        let mut statement = self.connection.prepare(
            "SELECT d.id, d.title, d.file_name, d.content_hash, d.added_at, f.name,
                    d.reading_section, d.reading_paragraph, d.read_at
             FROM documents d LEFT JOIN folders f ON f.id = d.folder_id
             ORDER BY d.added_at, d.id",
        )?;
        let documents = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    BackupDocument {
                        title: row.get(1)?,
                        file_name: row.get(2)?,
                        content_hash: row.get(3)?,
                        added_at: row.get(4)?,
                        folder: row.get(5)?,
                        reading_section: row.get(6)?,
                        reading_paragraph: row.get(7)?,
                        read_at: row.get(8)?,
                        bookmarks: Vec::new(),
                    },
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut bookmarks = self.connection.prepare(
            "SELECT section, paragraph, created_at FROM bookmarks
             WHERE document_id = ?1 ORDER BY section, paragraph",
        )?;
        documents
            .into_iter()
            .map(|(id, document)| {
                let bookmarks = bookmarks
                    .query_map([id], |row| {
                        Ok(BackupBookmark {
                            section: row.get(0)?,
                            paragraph: row.get(1)?,
                            created_at: row.get(2)?,
                        })
                    })?
                    .collect::<rusqlite::Result<_>>()?;
                Ok(BackupDocument {
                    bookmarks,
                    ..document
                })
            })
            .collect()
    }
}

fn restore_words(connection: &Connection, words: &[BackupWord]) -> Result<u32> {
    let mut upsert = connection.prepare(
        "INSERT INTO words (word, status, card, due_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (word) DO UPDATE SET
           status = excluded.status, card = excluded.card,
           due_at = excluded.due_at, updated_at = excluded.updated_at
         WHERE excluded.updated_at > words.updated_at",
    )?;
    let mut changed = 0;
    for word in words {
        let (card, due_at) = match word.status {
            WordStatus::Known => (None, None),
            WordStatus::Learning => {
                let card = word
                    .card
                    .as_ref()
                    .and_then(|card| serde_json::from_value::<Card>(card.clone()).ok())
                    .ok_or_else(|| {
                        Error::InvalidBackup(format!("\"{}\" has no review schedule", word.word))
                    })?;
                (
                    Some(serde_json::to_string(&card)?),
                    Some(word.due_at.unwrap_or(card.due.timestamp_millis())),
                )
            }
        };
        changed += upsert.execute(params![
            word.word,
            word.status.as_str(),
            card,
            due_at,
            word.updated_at
        ])? as u32;
    }
    Ok(changed)
}

fn restore_reviews(connection: &Connection, reviews: &[BackupReview]) -> Result<u32> {
    let mut insert = connection.prepare(
        "INSERT INTO reviews (word, rating, reviewed_at) SELECT ?1, ?2, ?3
         WHERE NOT EXISTS
           (SELECT 1 FROM reviews WHERE reviewed_at = ?3 AND word = ?1 AND rating = ?2)",
    )?;
    let mut added = 0;
    for review in reviews {
        if !(1..=4).contains(&review.rating) {
            return Err(Error::InvalidBackup(format!(
                "a review of \"{}\" is rated {}",
                review.word, review.rating
            )));
        }
        added += insert.execute(params![review.word, review.rating, review.reviewed_at])? as u32;
    }
    Ok(added)
}

/// Returns how many of `documents` are in the library and how many are not.
fn restore_documents(
    connection: &Connection,
    documents: &[BackupDocument],
    now: DateTime<Utc>,
) -> Result<(u32, u32)> {
    let mut find = connection
        .prepare("SELECT id, read_at, folder_id FROM documents WHERE content_hash = ?1")?;
    let mut move_to = connection.prepare(
        "UPDATE documents SET reading_section = ?2, reading_paragraph = ?3, read_at = ?4
         WHERE id = ?1 AND EXISTS
           (SELECT 1 FROM document_sections WHERE document_id = ?1 AND position = ?2)",
    )?;
    let mut bookmark = connection.prepare(
        "INSERT OR IGNORE INTO bookmarks (document_id, section, paragraph, created_at)
         SELECT ?1, ?2, ?3, ?4 WHERE EXISTS
           (SELECT 1 FROM document_sections WHERE document_id = ?1 AND position = ?2)",
    )?;
    let (mut found, mut missing) = (0, 0);
    for document in documents {
        let stored = match &document.content_hash {
            Some(hash) => find
                .query_row([hash], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                        row.get::<_, Option<i64>>(2)?,
                    ))
                })
                .optional()?,
            None => None,
        };
        let Some((id, read_at, folder_id)) = stored else {
            missing += 1;
            continue;
        };
        found += 1;
        if document.read_at > read_at {
            move_to.execute(params![
                id,
                document.reading_section,
                document.reading_paragraph,
                document.read_at
            ])?;
        }
        for mark in &document.bookmarks {
            bookmark.execute(params![id, mark.section, mark.paragraph, mark.created_at])?;
        }
        let folder = document.folder.as_deref().map(str::trim);
        if let (None, Some(name)) = (folder_id, folder.filter(|name| !name.is_empty())) {
            let folder = folder_named(connection, name, now)?;
            connection.execute(
                "UPDATE documents SET folder_id = ?2 WHERE id = ?1",
                params![id, folder],
            )?;
        }
    }
    Ok((found, missing))
}

/// The folder called `name`, made if there is none.
fn folder_named(connection: &Connection, name: &str, now: DateTime<Utc>) -> Result<i64> {
    let existing = connection
        .query_row(
            "SELECT id FROM folders WHERE name = ?1 ORDER BY id LIMIT 1",
            [name],
            |row| row.get(0),
        )
        .optional()?;
    if let Some(id) = existing {
        return Ok(id);
    }
    connection.execute(
        "INSERT INTO folders (name, created_at) VALUES (?1, ?2)",
        params![name, now.timestamp_millis()],
    )?;
    Ok(connection.last_insert_rowid())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::Section;
    use crate::store::NewDocument;
    use crate::store::test_support::*;
    use chrono::Duration;

    /// A store holding one two-section book, as a second device would after importing it.
    fn store_with_book() -> (Store, i64) {
        let mut store = Store::open_in_memory().unwrap();
        let section = |text: &str| Section {
            title: None,
            text: text.to_owned(),
        };
        let id = store
            .add_document(
                &NewDocument {
                    title: "书",
                    file_name: "book.epub",
                    content_hash: "hash-of-book",
                    analysis: &analysis(&[("学习", 2)]),
                    sections: &[section("学习。"), section("再学习。")],
                    cover: None,
                },
                now(),
            )
            .unwrap();
        (store, id)
    }

    fn import(store: &mut Store, backup: &Backup) -> BackupImport {
        store.restore_backup(backup, now()).unwrap()
    }

    #[test]
    fn restores_a_backup_onto_another_device_once() {
        let (mut source, id) = store_with_book();
        source.set_status("的", WordStatus::Known, now()).unwrap();
        source
            .set_status("学习", WordStatus::Learning, now())
            .unwrap();
        source.review("学习", 3, now()).unwrap();
        source.set_reading_position(id, 1, 2, now()).unwrap();
        source.add_bookmark(id, 1, 0, now()).unwrap();
        let mut backup = source.backup(now()).unwrap();
        backup.documents[0].folder = Some("小说".into());

        let (mut target, target_id) = store_with_book();
        assert_eq!(
            import(&mut target, &backup),
            BackupImport {
                words: 2,
                reviews: 1,
                documents: 1,
                missing_documents: 0
            }
        );
        let restored = target.backup(now()).unwrap();
        assert_eq!(restored.words, backup.words);
        assert_eq!(restored.reviews, backup.reviews);
        assert_eq!(restored.documents, backup.documents);
        assert_eq!(target.due_count(now(), None).unwrap(), 0);
        assert_eq!(target.document(target_id).unwrap().reading_section, 1);

        assert_eq!(
            import(&mut target, &backup),
            BackupImport {
                documents: 1,
                ..BackupImport::default()
            }
        );
        assert_eq!(target.backup(now()).unwrap(), restored);
    }

    #[test]
    fn keeps_what_this_device_changed_more_recently() {
        let (mut source, id) = store_with_book();
        source.set_status("学习", WordStatus::Known, now()).unwrap();
        source.set_reading_position(id, 1, 0, now()).unwrap();
        let backup = source.backup(now()).unwrap();

        let (mut target, target_id) = store_with_book();
        let later = now() + Duration::hours(1);
        target
            .set_status("学习", WordStatus::Learning, later)
            .unwrap();
        target.set_reading_position(target_id, 0, 3, later).unwrap();

        assert_eq!(import(&mut target, &backup).words, 0);
        assert_eq!(
            target.statuses(&["学习".into()]).unwrap()["学习"],
            WordStatus::Learning
        );
        let document = target.document(target_id).unwrap();
        assert_eq!(
            (document.reading_section, document.reading_paragraph),
            (0, 3)
        );
    }

    #[test]
    fn counts_books_that_are_not_in_the_library() {
        let backup = store_with_book().0.backup(now()).unwrap();

        let mut target = Store::open_in_memory().unwrap();
        assert_eq!(import(&mut target, &backup).missing_documents, 1);
    }

    #[test]
    fn refuses_other_files_and_newer_backups() {
        let (store, _) = store_with_book();
        let backup = store.backup(now()).unwrap();
        let mut target = Store::open_in_memory().unwrap();

        let foreign = Backup {
            app: "other".into(),
            ..backup.clone()
        };
        assert!(matches!(
            target.restore_backup(&foreign, now()),
            Err(Error::InvalidBackup(_))
        ));
        let newer = Backup {
            version: BACKUP_VERSION + 1,
            ..backup
        };
        assert!(matches!(
            target.restore_backup(&newer, now()),
            Err(Error::NewerBackup(_))
        ));
    }

    #[test]
    fn backs_up_words_reviews_and_reading_places() {
        let (mut store, id) = store_with_document();
        store.set_status("的", WordStatus::Known, now()).unwrap();
        store
            .set_status("学习", WordStatus::Learning, now())
            .unwrap();
        store.review("学习", 3, now()).unwrap();
        store.set_reading_position(id, 0, 4, now()).unwrap();

        let backup = store.backup(now()).unwrap();
        assert_eq!(
            (backup.app.as_str(), backup.version, backup.exported_at),
            ("fanfan", 1, now().timestamp_millis())
        );
        assert_eq!(
            backup
                .words
                .iter()
                .map(|w| (w.word.as_str(), w.status, w.card.is_some()))
                .collect::<Vec<_>>(),
            [
                ("学习", WordStatus::Learning, true),
                ("的", WordStatus::Known, false)
            ]
        );
        assert_eq!(
            backup.reviews,
            [BackupReview {
                word: "学习".into(),
                rating: 3,
                reviewed_at: now().timestamp_millis()
            }]
        );
        let document = &backup.documents[0];
        assert_eq!(
            (
                document.title.as_str(),
                document.content_hash.as_deref(),
                document.reading_paragraph,
                document.read_at
            ),
            (
                "书",
                Some("hash-of-book"),
                4,
                Some(now().timestamp_millis())
            )
        );
        assert!(document.bookmarks.is_empty());
    }
}
