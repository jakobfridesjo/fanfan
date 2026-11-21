use chrono::{DateTime, Utc};
use serde::Serialize;

use super::{Store, WordStatus};
use crate::error::Result;

/// Bumped whenever the shape of [`Backup`] changes.
const BACKUP_VERSION: u32 = 1;

/// Everything the learner made: word statuses with their review schedules, the
/// review history, and per book where they are reading and what they bookmarked.
/// A book's text is left out; its file restores it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub app: &'static str,
    pub version: u32,
    /// Unix milliseconds, like every other time in the backup.
    pub exported_at: i64,
    pub words: Vec<BackupWord>,
    pub reviews: Vec<BackupReview>,
    pub documents: Vec<BackupDocument>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupWord {
    pub word: String,
    pub status: WordStatus,
    /// The FSRS card of a learning word.
    pub card: Option<serde_json::Value>,
    pub due_at: Option<i64>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupReview {
    pub word: String,
    /// 1 (again) to 4 (easy).
    pub rating: u8,
    pub reviewed_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupBookmark {
    pub section: u32,
    pub paragraph: u32,
    pub created_at: i64,
}

impl Store {
    /// A [`Backup`] of one snapshot of the database.
    pub fn backup(&self, now: DateTime<Utc>) -> Result<Backup> {
        self.snapshot(|store| {
            Ok(Backup {
                app: "fanfan",
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_support::*;

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
            (backup.app, backup.version, backup.exported_at),
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
