use std::path::Path;

use rusqlite::Connection;
use rusqlite_migration::{M, Migrations};
use serde::{Deserialize, Serialize};

use crate::analysis::Analysis;
use crate::error::Result;
use crate::extract::{Cover, Section};

mod documents;
mod folders;
mod words;

const MIGRATIONS: &[M<'_>] = &[
    M::up(
        "CREATE TABLE documents (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        file_name TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL
    );
    CREATE TABLE document_words (
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        word TEXT NOT NULL,
        rank INTEGER NOT NULL,
        count INTEGER NOT NULL,
        example TEXT NOT NULL,
        PRIMARY KEY (document_id, word)
    );
    CREATE INDEX document_words_by_rank ON document_words (document_id, rank);
    CREATE INDEX document_words_by_word ON document_words (word);
    CREATE TABLE words (
        word TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('known', 'learning')),
        card TEXT,
        due_at INTEGER,
        updated_at INTEGER NOT NULL
    );
    CREATE INDEX words_by_due ON words (due_at) WHERE status = 'learning';
    CREATE TABLE reviews (
        id INTEGER PRIMARY KEY,
        word TEXT NOT NULL,
        rating INTEGER NOT NULL,
        reviewed_at INTEGER NOT NULL
    );",
    ),
    M::up(
        "CREATE TABLE document_covers (
        document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
        mime TEXT NOT NULL,
        image BLOB NOT NULL
    );",
    ),
    // Documents imported before this have no hash and never count as duplicates.
    M::up(
        "ALTER TABLE documents ADD COLUMN content_hash TEXT;
    CREATE UNIQUE INDEX documents_by_content_hash ON documents (content_hash);",
    ),
    M::up(
        "CREATE TABLE folders (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );
    ALTER TABLE documents ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;",
    ),
    // Books imported before this kept no text to read, so the library starts
    // over; known words and review history stay.
    M::up(
        "DELETE FROM documents;
    DELETE FROM folders;
    CREATE TABLE document_sections (
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        title TEXT,
        text TEXT NOT NULL,
        PRIMARY KEY (document_id, position)
    );
    ALTER TABLE documents ADD COLUMN reading_section INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE documents ADD COLUMN reading_paragraph INTEGER NOT NULL DEFAULT 0;",
    ),
    M::up("CREATE INDEX reviews_by_time ON reviews (reviewed_at);"),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WordStatus {
    Known,
    Learning,
}

impl WordStatus {
    fn as_str(self) -> &'static str {
        match self {
            Self::Known => "known",
            Self::Learning => "learning",
        }
    }

    fn parse(value: &str) -> rusqlite::Result<Self> {
        match value {
            "known" => Ok(Self::Known),
            "learning" => Ok(Self::Learning),
            other => Err(rusqlite::Error::InvalidColumnType(
                0,
                format!("status {other}"),
                rusqlite::types::Type::Text,
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSummary {
    pub id: i64,
    pub title: String,
    pub file_name: String,
    pub added_at: i64,
    pub total_tokens: u32,
    pub unique_words: u32,
    pub known_tokens: u32,
    pub learning_tokens: u32,
    pub unseen_words: u32,
    pub has_cover: bool,
    pub folder_id: Option<i64>,
    /// Where the reader left off: a section position and a paragraph in it.
    pub reading_section: u32,
    pub reading_paragraph: u32,
}

/// An imported book to add to the library.
#[derive(Debug, Clone, Copy)]
pub struct NewDocument<'a> {
    pub title: &'a str,
    pub file_name: &'a str,
    /// Tells a re-import of the same file apart.
    pub content_hash: &'a str,
    pub analysis: &'a Analysis,
    pub sections: &'a [Section],
    pub cover: Option<&'a Cover>,
}

/// Books grouped on the shelf. A folder exists only while it holds a book.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: i64,
    pub name: String,
}

/// A learning word due for review, with an example sentence from any book that has it.
#[derive(Debug, Clone, PartialEq)]
pub struct DueWord {
    pub word: String,
    pub example: Option<String>,
    /// How far each rating, again to easy, would put off the next review, in milliseconds.
    pub intervals: [i64; 4],
}

#[derive(Debug, Clone, PartialEq)]
pub struct DocumentWord {
    pub word: String,
    pub count: u32,
    pub example: String,
}

/// A review and the word's row before it, so [`Store::undo_review`] can take it back.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSnapshot {
    pub word: WordSnapshot,
    pub review_id: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Reviewed {
    pub due_at: i64,
    pub snapshot: ReviewSnapshot,
}

/// A word's row before a change, so the change can be undone.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordSnapshot {
    pub word: String,
    pub previous: Option<StoredWord>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredWord {
    pub status: WordStatus,
    pub card: Option<String>,
    pub due_at: Option<i64>,
    pub updated_at: i64,
}

/// A word the learner knows or is learning.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrackedWord {
    pub word: String,
    pub status: WordStatus,
    /// When a learning word is next due; `None` for a known word.
    pub due_at: Option<i64>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordCounts {
    pub known: u32,
    pub learning: u32,
    pub due: u32,
}

pub struct Store {
    connection: Connection,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let connection = Connection::open(path)?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        // With WAL, NORMAL still survives a crash and skips a sync per commit.
        connection.pragma_update(None, "synchronous", "NORMAL")?;
        Self::init(connection)
    }

    /// Another connection to a database [`Store::open`] has set up, for queries
    /// only: in WAL mode it reads while the other connection writes.
    pub fn open_reader(path: &Path) -> Result<Self> {
        let connection = Connection::open(path)?;
        connection.pragma_update(None, "query_only", true)?;
        Ok(Self { connection })
    }

    pub fn open_in_memory() -> Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(mut connection: Connection) -> Result<Self> {
        connection.pragma_update(None, "foreign_keys", "ON")?;
        Migrations::from_slice(MIGRATIONS).to_latest(&mut connection)?;
        Ok(Self { connection })
    }

    /// Runs `read` against one snapshot of the database, so writes through
    /// another connection meanwhile do not show up halfway.
    pub fn snapshot<T>(&self, read: impl FnOnce(&Self) -> Result<T>) -> Result<T> {
        let transaction = self.connection.unchecked_transaction()?;
        let value = read(self)?;
        transaction.commit()?;
        Ok(value)
    }
}

#[cfg(test)]
mod test_support {
    use super::*;
    use crate::analysis::WordStat;
    use chrono::{DateTime, TimeZone, Utc};

    pub(super) fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap()
    }

    pub(super) fn analysis(words: &[(&str, u32)]) -> Analysis {
        Analysis {
            total_tokens: words.iter().map(|(_, count)| count).sum(),
            words: words
                .iter()
                .map(|&(word, count)| WordStat {
                    word: word.to_owned(),
                    count,
                    example: format!("{word}的例句。"),
                })
                .collect(),
        }
    }

    pub(super) fn store_with_document() -> (Store, i64) {
        let mut store = Store::open_in_memory().unwrap();
        let id = store
            .add_document(
                &NewDocument {
                    title: "书",
                    file_name: "book.epub",
                    content_hash: "hash-of-book",
                    analysis: &analysis(&[("的", 50), ("我们", 30), ("学习", 15), ("中文", 5)]),
                    sections: &[],
                    cover: None,
                },
                now(),
            )
            .unwrap();
        (store, id)
    }

    pub(super) fn unseen(store: &Store, id: i64) -> Vec<String> {
        store
            .unseen_words(id, None)
            .unwrap()
            .into_iter()
            .map(|w| w.word)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::*;
    use super::*;

    #[test]
    fn a_reader_sees_committed_writes_but_cannot_write() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vocab.sqlite3");
        let mut writer = Store::open(&path).unwrap();
        let mut reader = Store::open_reader(&path).unwrap();

        writer.set_status("中文", WordStatus::Known, now()).unwrap();
        assert_eq!(reader.counts(now()).unwrap().known, 1);
        assert!(reader.set_status("学习", WordStatus::Known, now()).is_err());
    }
}
