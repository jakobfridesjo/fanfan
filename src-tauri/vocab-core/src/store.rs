use std::collections::HashMap;
use std::ops::ControlFlow;
use std::path::Path;

use chrono::{DateTime, Utc};
use rs_fsrs::{Card, FSRS, Rating};
use rusqlite::{Connection, OptionalExtension, Row, params};
use rusqlite_migration::{M, Migrations};
use serde::{Deserialize, Serialize};

use crate::analysis::Analysis;
use crate::error::{Error, Result};
use crate::extract::Cover;
use crate::extract::Section;

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

const RATINGS: [Rating; 4] = [Rating::Again, Rating::Hard, Rating::Good, Rating::Easy];

/// A stored FSRS card, or a new one due now for a word that has never been scheduled.
fn fsrs_card(json: Option<&str>, now: DateTime<Utc>) -> Result<Card> {
    Ok(match json {
        Some(json) => serde_json::from_str(json)?,
        None => Card {
            due: now,
            ..Card::new()
        },
    })
}

fn restore_row(connection: &Connection, snapshot: &WordSnapshot) -> Result<()> {
    match &snapshot.previous {
        None => {
            connection.execute("DELETE FROM words WHERE word = ?1", [&snapshot.word])?;
        }
        Some(stored) => {
            connection.execute(
                "INSERT OR REPLACE INTO words (word, status, card, due_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    snapshot.word,
                    stored.status.as_str(),
                    stored.card,
                    stored.due_at,
                    stored.updated_at
                ],
            )?;
        }
    }
    Ok(())
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

    /// Fails with [`Error::AlreadyImported`] when a file with these exact bytes is in the library.
    pub fn ensure_not_imported(&self, content_hash: &str) -> Result<()> {
        ensure_not_imported(&self.connection, content_hash)
    }

    pub fn add_document(&mut self, document: &NewDocument<'_>, now: DateTime<Utc>) -> Result<i64> {
        let NewDocument {
            title,
            file_name,
            content_hash,
            analysis,
            sections,
            cover,
        } = *document;
        let transaction = self.connection.transaction()?;
        ensure_not_imported(&transaction, content_hash)?;
        transaction.execute(
            "INSERT INTO documents (title, file_name, content_hash, added_at, total_tokens)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                title,
                file_name,
                content_hash,
                now.timestamp_millis(),
                analysis.total_tokens
            ],
        )?;
        let id = transaction.last_insert_rowid();
        if let Some(cover) = cover {
            transaction.execute(
                "INSERT INTO document_covers (document_id, mime, image) VALUES (?1, ?2, ?3)",
                params![id, cover.mime, cover.image],
            )?;
        }
        {
            let mut insert = transaction.prepare(
                "INSERT INTO document_words (document_id, word, rank, count, example)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )?;
            for (rank, stat) in (0_i64..).zip(&analysis.words) {
                insert.execute(params![id, stat.word, rank, stat.count, stat.example])?;
            }
            let mut insert = transaction.prepare(
                "INSERT INTO document_sections (document_id, position, title, text)
                 VALUES (?1, ?2, ?3, ?4)",
            )?;
            for (position, section) in (0_i64..).zip(sections) {
                insert.execute(params![id, position, section.title, section.text])?;
            }
        }
        transaction.commit()?;
        Ok(id)
    }

    pub fn documents(&self) -> Result<Vec<DocumentSummary>> {
        let mut statement = self.connection.prepare(&format!(
            "{SUMMARY_QUERY} GROUP BY d.id ORDER BY d.added_at DESC, d.id DESC"
        ))?;
        let summaries = statement
            .query_map([], summary_from_row)?
            .collect::<rusqlite::Result<_>>()?;
        Ok(summaries)
    }

    pub fn document(&self, id: i64) -> Result<DocumentSummary> {
        self.connection
            .query_row(
                &format!("{SUMMARY_QUERY} WHERE d.id = ?1 GROUP BY d.id"),
                [id],
                summary_from_row,
            )
            .optional()?
            .ok_or(Error::DocumentNotFound(id))
    }

    /// The cover image, if the document came with one.
    pub fn cover(&self, document_id: i64) -> Result<Option<Cover>> {
        Ok(self
            .connection
            .query_row(
                "SELECT mime, image FROM document_covers WHERE document_id = ?1",
                [document_id],
                |row| {
                    Ok(Cover {
                        mime: row.get(0)?,
                        image: row.get(1)?,
                    })
                },
            )
            .optional()?)
    }

    pub fn delete_document(&mut self, id: i64) -> Result<()> {
        let transaction = self.connection.transaction()?;
        let deleted = transaction.execute("DELETE FROM documents WHERE id = ?1", [id])?;
        if deleted == 0 {
            return Err(Error::DocumentNotFound(id));
        }
        delete_empty_folders(&transaction)?;
        transaction.commit()?;
        Ok(())
    }

    /// Each section's title in reading order; an untitled section has `None`.
    pub fn section_titles(&self, document_id: i64) -> Result<Vec<Option<String>>> {
        self.ensure_document(document_id)?;
        let mut statement = self.connection.prepare(
            "SELECT title FROM document_sections WHERE document_id = ?1 ORDER BY position",
        )?;
        let titles = statement
            .query_map([document_id], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        Ok(titles)
    }

    pub fn section(&self, document_id: i64, position: u32) -> Result<Section> {
        self.connection
            .query_row(
                "SELECT title, text FROM document_sections WHERE document_id = ?1 AND position = ?2",
                params![document_id, position],
                |row| {
                    Ok(Section {
                        title: row.get(0)?,
                        text: row.get(1)?,
                    })
                },
            )
            .optional()?
            .ok_or(Error::SectionNotFound(document_id, position))
    }

    pub fn set_reading_position(
        &mut self,
        document_id: i64,
        section: u32,
        paragraph: u32,
    ) -> Result<()> {
        let updated = self.connection.execute(
            "UPDATE documents SET reading_section = ?2, reading_paragraph = ?3 WHERE id = ?1",
            params![document_id, section, paragraph],
        )?;
        if updated == 0 {
            return Err(Error::DocumentNotFound(document_id));
        }
        Ok(())
    }

    fn ensure_document(&self, id: i64) -> Result<()> {
        let exists: bool = self.connection.query_row(
            "SELECT EXISTS (SELECT 1 FROM documents WHERE id = ?1)",
            [id],
            |row| row.get(0),
        )?;
        if exists {
            Ok(())
        } else {
            Err(Error::DocumentNotFound(id))
        }
    }

    /// The status of each of `words` that is known or being learned; unseen words are left out.
    pub fn statuses(&self, words: &[String]) -> Result<HashMap<String, WordStatus>> {
        let mut statement = self.connection.prepare(
            "SELECT word, status FROM words WHERE word IN (SELECT value FROM json_each(?1))",
        )?;
        let statuses = statement
            .query_map([serde_json::to_string(words)?], |row| {
                Ok((row.get(0)?, WordStatus::parse(&row.get::<_, String>(1)?)?))
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(statuses)
    }

    pub fn folders(&self) -> Result<Vec<Folder>> {
        let mut statement = self
            .connection
            .prepare("SELECT id, name FROM folders ORDER BY created_at DESC, id DESC")?;
        let folders = statement
            .query_map([], |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(folders)
    }

    /// Puts the documents, taken out of any folder they were in, into a new folder.
    pub fn create_folder(
        &mut self,
        name: &str,
        document_ids: &[i64],
        now: DateTime<Utc>,
    ) -> Result<Folder> {
        let name = folder_name(name)?;
        if document_ids.len() < 2 {
            return Err(Error::TooFewBooksForFolder);
        }
        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT INTO folders (name, created_at) VALUES (?1, ?2)",
            params![name, now.timestamp_millis()],
        )?;
        let id = transaction.last_insert_rowid();
        for &document_id in document_ids {
            set_folder(&transaction, document_id, Some(id))?;
        }
        delete_empty_folders(&transaction)?;
        transaction.commit()?;
        Ok(Folder {
            id,
            name: name.to_owned(),
        })
    }

    pub fn rename_folder(&mut self, id: i64, name: &str) -> Result<()> {
        let renamed = self.connection.execute(
            "UPDATE folders SET name = ?2 WHERE id = ?1",
            params![id, folder_name(name)?],
        )?;
        if renamed == 0 {
            return Err(Error::FolderNotFound(id));
        }
        Ok(())
    }

    /// Moves a document into a folder, or back onto the shelf with `None`.
    /// A folder left empty disappears.
    pub fn move_document(&mut self, document_id: i64, folder_id: Option<i64>) -> Result<()> {
        let transaction = self.connection.transaction()?;
        if let Some(folder_id) = folder_id {
            let exists: bool = transaction.query_row(
                "SELECT EXISTS (SELECT 1 FROM folders WHERE id = ?1)",
                [folder_id],
                |row| row.get(0),
            )?;
            if !exists {
                return Err(Error::FolderNotFound(folder_id));
            }
        }
        set_folder(&transaction, document_id, folder_id)?;
        delete_empty_folders(&transaction)?;
        transaction.commit()?;
        Ok(())
    }

    /// The document's words that are neither known nor being learned, most frequent first.
    pub fn unseen_words(&self, document_id: i64, limit: Option<u32>) -> Result<Vec<DocumentWord>> {
        let mut statement = self.connection.prepare(
            "SELECT dw.word, dw.count, dw.example FROM document_words dw
             LEFT JOIN words w ON w.word = dw.word
             WHERE dw.document_id = ?1 AND w.word IS NULL
             ORDER BY dw.rank LIMIT ?2",
        )?;
        let limit = limit.map_or(-1, i64::from);
        let words = statement
            .query_map(params![document_id, limit], |row| {
                Ok(DocumentWord {
                    word: row.get(0)?,
                    count: row.get(1)?,
                    example: row.get(2)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(words)
    }

    /// How many more unseen words, taken most frequent first, bring known plus
    /// learning words to `target` (0–1) of the document's tokens.
    pub fn words_to_reach(&self, document_id: i64, target: f64) -> Result<u32> {
        let summary = self.document(document_id)?;
        let goal = (f64::from(summary.total_tokens) * target).ceil() as u64;
        let mut covered = u64::from(summary.known_tokens + summary.learning_tokens);
        let mut needed = 0;
        for word in self.unseen_words(document_id, None)? {
            if covered >= goal {
                break;
            }
            covered += u64::from(word.count);
            needed += 1;
        }
        Ok(needed)
    }

    /// An example sentence for a word from any document that contains it.
    pub fn example_for(&self, word: &str) -> Result<Option<String>> {
        Ok(self
            .connection
            .query_row(
                "SELECT example FROM document_words WHERE word = ?1 ORDER BY document_id LIMIT 1",
                [word],
                |row| row.get(0),
            )
            .optional()?)
    }

    fn stored_word(&self, word: &str) -> Result<Option<StoredWord>> {
        Ok(self
            .connection
            .query_row(
                "SELECT status, card, due_at, updated_at FROM words WHERE word = ?1",
                [word],
                |row| {
                    Ok(StoredWord {
                        status: WordStatus::parse(&row.get::<_, String>(0)?)?,
                        card: row.get(1)?,
                        due_at: row.get(2)?,
                        updated_at: row.get(3)?,
                    })
                },
            )
            .optional()?)
    }

    /// Marks a word known, or starts learning it with a new card due now.
    /// Returns what the word was before, for `restore`.
    pub fn set_status(
        &mut self,
        word: &str,
        status: WordStatus,
        now: DateTime<Utc>,
    ) -> Result<WordSnapshot> {
        let previous = self.stored_word(word)?;
        let (card, due_at) = match status {
            WordStatus::Known => (None, None),
            WordStatus::Learning => {
                let card = Card {
                    due: now,
                    ..Card::new()
                };
                (
                    Some(serde_json::to_string(&card)?),
                    Some(now.timestamp_millis()),
                )
            }
        };
        self.connection.execute(
            "INSERT INTO words (word, status, card, due_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (word) DO UPDATE SET
               status = excluded.status, card = excluded.card,
               due_at = excluded.due_at, updated_at = excluded.updated_at",
            params![word, status.as_str(), card, due_at, now.timestamp_millis()],
        )?;
        Ok(WordSnapshot {
            word: word.to_owned(),
            previous,
        })
    }

    pub fn restore(&mut self, snapshot: &WordSnapshot) -> Result<()> {
        restore_row(&self.connection, snapshot)
    }

    /// Takes back a review: the word is scheduled as before and the review leaves the history.
    pub fn undo_review(&mut self, snapshot: &ReviewSnapshot) -> Result<()> {
        let transaction = self.connection.transaction()?;
        restore_row(&transaction, &snapshot.word)?;
        transaction.execute("DELETE FROM reviews WHERE id = ?1", [snapshot.review_id])?;
        transaction.commit()?;
        Ok(())
    }

    /// Learning words due at `now`, most overdue first, each with the example [`Store::example_for`] gives.
    pub fn due_words(&self, now: DateTime<Utc>, limit: u32) -> Result<Vec<DueWord>> {
        let mut statement = self.connection.prepare(
            "SELECT w.word, (SELECT dw.example FROM document_words dw
                             WHERE dw.word = w.word ORDER BY dw.document_id LIMIT 1), w.card
             FROM words w WHERE w.status = 'learning' AND w.due_at <= ?1
             ORDER BY w.due_at, w.word LIMIT ?2",
        )?;
        let rows = statement
            .query_map(params![now.timestamp_millis(), limit], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let fsrs = FSRS::default();
        rows.into_iter()
            .map(|(word, example, card)| {
                let outcomes = fsrs.repeat(fsrs_card(card.as_deref(), now)?, now);
                Ok(DueWord {
                    word,
                    example,
                    intervals: RATINGS
                        .map(|rating| (outcomes[&rating].card.due - now).num_milliseconds()),
                })
            })
            .collect()
    }

    pub fn next_due_at(&self) -> Result<Option<i64>> {
        Ok(self.connection.query_row(
            "SELECT MIN(due_at) FROM words WHERE status = 'learning'",
            [],
            |row| row.get(0),
        )?)
    }

    /// Schedules a learning word's next review. `rating` is 1 (again) to 4 (easy).
    pub fn review(&mut self, word: &str, rating: u8, now: DateTime<Utc>) -> Result<Reviewed> {
        let rating = match rating {
            1 => Rating::Again,
            2 => Rating::Hard,
            3 => Rating::Good,
            4 => Rating::Easy,
            other => return Err(Error::InvalidRating(other)),
        };
        let stored = self
            .stored_word(word)?
            .filter(|stored| stored.status == WordStatus::Learning)
            .ok_or_else(|| Error::NotLearning(word.to_owned()))?;
        let card = fsrs_card(stored.card.as_deref(), now)?;
        let next = FSRS::default().next(card, now, rating).card;
        let due_at = next.due.timestamp_millis();

        let transaction = self.connection.transaction()?;
        transaction.execute(
            "UPDATE words SET card = ?2, due_at = ?3, updated_at = ?4 WHERE word = ?1",
            params![
                word,
                serde_json::to_string(&next)?,
                due_at,
                now.timestamp_millis()
            ],
        )?;
        transaction.execute(
            "INSERT INTO reviews (word, rating, reviewed_at) VALUES (?1, ?2, ?3)",
            params![word, rating as u8, now.timestamp_millis()],
        )?;
        let review_id = transaction.last_insert_rowid();
        transaction.commit()?;
        Ok(Reviewed {
            due_at,
            snapshot: ReviewSnapshot {
                word: WordSnapshot {
                    word: word.to_owned(),
                    previous: Some(stored),
                },
                review_id,
            },
        })
    }

    /// Every known or learning word, most recently changed first.
    pub fn tracked_words(&self) -> Result<Vec<TrackedWord>> {
        let mut statement = self.connection.prepare(
            "SELECT word, status, due_at, updated_at FROM words ORDER BY updated_at DESC, word",
        )?;
        let words = statement
            .query_map([], |row| {
                Ok(TrackedWord {
                    word: row.get(0)?,
                    status: WordStatus::parse(&row.get::<_, String>(1)?)?,
                    due_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(words)
    }

    /// Marks every word known; returns how many were not known before.
    pub fn import_known(&mut self, words: &[String], now: DateTime<Utc>) -> Result<u32> {
        let transaction = self.connection.transaction()?;
        let mut added = 0;
        {
            let mut upsert = transaction.prepare(
                "INSERT INTO words (word, status, updated_at) VALUES (?1, 'known', ?2)
                 ON CONFLICT (word) DO UPDATE SET
                   status = 'known', card = NULL, due_at = NULL, updated_at = excluded.updated_at
                 WHERE words.status <> 'known'",
            )?;
            for word in words {
                added += upsert.execute(params![word, now.timestamp_millis()])? as u32;
            }
        }
        transaction.commit()?;
        Ok(added)
    }

    /// Each review's time and rating from `from` (Unix milliseconds) on, oldest first.
    pub fn reviews_since(&self, from: i64) -> Result<Vec<(i64, u8)>> {
        let mut statement = self.connection.prepare(
            "SELECT reviewed_at, rating FROM reviews WHERE reviewed_at >= ?1 ORDER BY reviewed_at",
        )?;
        let rows = statement.query_map([from], |row| Ok((row.get(0)?, row.get(1)?)))?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// Passes each review's time to `visit`, newest first, until it breaks.
    pub fn visit_review_times_newest_first(
        &self,
        mut visit: impl FnMut(i64) -> ControlFlow<()>,
    ) -> Result<()> {
        let mut statement = self
            .connection
            .prepare("SELECT reviewed_at FROM reviews ORDER BY reviewed_at DESC")?;
        let mut rows = statement.query([])?;
        while let Some(row) = rows.next()? {
            if visit(row.get(0)?).is_break() {
                break;
            }
        }
        Ok(())
    }

    /// Every learning word's FSRS card.
    pub fn learning_cards(&self) -> Result<Vec<Card>> {
        let mut statement = self
            .connection
            .prepare("SELECT card FROM words WHERE status = 'learning' AND card IS NOT NULL")?;
        let cards = statement
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        cards
            .iter()
            .map(|json| Ok(serde_json::from_str(json)?))
            .collect()
    }

    pub fn counts(&self, now: DateTime<Utc>) -> Result<WordCounts> {
        Ok(self.connection.query_row(
            "SELECT
               COUNT(*) FILTER (WHERE status = 'known'),
               COUNT(*) FILTER (WHERE status = 'learning'),
               COUNT(*) FILTER (WHERE status = 'learning' AND due_at <= ?1)
             FROM words",
            [now.timestamp_millis()],
            |row| {
                Ok(WordCounts {
                    known: row.get(0)?,
                    learning: row.get(1)?,
                    due: row.get(2)?,
                })
            },
        )?)
    }
}

fn ensure_not_imported(connection: &Connection, content_hash: &str) -> Result<()> {
    let existing: Option<String> = connection
        .query_row(
            "SELECT title FROM documents WHERE content_hash = ?1",
            [content_hash],
            |row| row.get(0),
        )
        .optional()?;
    match existing {
        Some(title) => Err(Error::AlreadyImported(title)),
        None => Ok(()),
    }
}

fn folder_name(name: &str) -> Result<&str> {
    let name = name.trim();
    if name.is_empty() {
        return Err(Error::EmptyFolderName);
    }
    Ok(name)
}

fn set_folder(connection: &Connection, document_id: i64, folder_id: Option<i64>) -> Result<()> {
    let moved = connection.execute(
        "UPDATE documents SET folder_id = ?2 WHERE id = ?1",
        params![document_id, folder_id],
    )?;
    if moved == 0 {
        return Err(Error::DocumentNotFound(document_id));
    }
    Ok(())
}

fn delete_empty_folders(connection: &Connection) -> Result<()> {
    connection.execute(
        "DELETE FROM folders WHERE id NOT IN
           (SELECT folder_id FROM documents WHERE folder_id IS NOT NULL)",
        [],
    )?;
    Ok(())
}

const SUMMARY_QUERY: &str = "SELECT d.id, d.title, d.file_name, d.added_at, d.total_tokens,
       COUNT(dw.word),
       COALESCE(SUM(dw.count) FILTER (WHERE w.status = 'known'), 0),
       COALESCE(SUM(dw.count) FILTER (WHERE w.status = 'learning'), 0),
       COUNT(dw.word) FILTER (WHERE w.word IS NULL),
       EXISTS (SELECT 1 FROM document_covers c WHERE c.document_id = d.id),
       d.folder_id, d.reading_section, d.reading_paragraph
     FROM documents d
     LEFT JOIN document_words dw ON dw.document_id = d.id
     LEFT JOIN words w ON w.word = dw.word";

fn summary_from_row(row: &Row<'_>) -> rusqlite::Result<DocumentSummary> {
    Ok(DocumentSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        file_name: row.get(2)?,
        added_at: row.get(3)?,
        total_tokens: row.get(4)?,
        unique_words: row.get(5)?,
        known_tokens: row.get(6)?,
        learning_tokens: row.get(7)?,
        unseen_words: row.get(8)?,
        has_cover: row.get(9)?,
        folder_id: row.get(10)?,
        reading_section: row.get(11)?,
        reading_paragraph: row.get(12)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::WordStat;
    use chrono::{Duration, TimeZone};

    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap()
    }

    fn analysis(words: &[(&str, u32)]) -> Analysis {
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

    fn store_with_document() -> (Store, i64) {
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

    fn due(store: &Store, at: DateTime<Utc>) -> Vec<String> {
        store
            .due_words(at, 10)
            .unwrap()
            .into_iter()
            .map(|w| w.word)
            .collect()
    }

    fn unseen(store: &Store, id: i64) -> Vec<String> {
        store
            .unseen_words(id, None)
            .unwrap()
            .into_iter()
            .map(|w| w.word)
            .collect()
    }

    #[test]
    fn refuses_a_document_already_in_the_library_until_it_is_deleted() {
        let (mut store, id) = store_with_document();
        let add_again = |store: &mut Store| {
            store.add_document(
                &NewDocument {
                    title: "另一本",
                    file_name: "copy.epub",
                    content_hash: "hash-of-book",
                    analysis: &analysis(&[]),
                    sections: &[],
                    cover: None,
                },
                now(),
            )
        };

        assert!(matches!(
            store.ensure_not_imported("hash-of-book"),
            Err(Error::AlreadyImported(title)) if title == "书"
        ));
        assert!(matches!(
            add_again(&mut store),
            Err(Error::AlreadyImported(_))
        ));
        assert_eq!(store.documents().unwrap().len(), 1);

        store.delete_document(id).unwrap();
        store.ensure_not_imported("hash-of-book").unwrap();
        add_again(&mut store).unwrap();
    }

    #[test]
    fn keeps_a_cover_until_its_document_is_deleted() {
        let (mut store, without) = store_with_document();
        let cover = Cover {
            mime: "image/jpeg".into(),
            image: b"jpeg".to_vec(),
        };
        let with = store
            .add_document(
                &NewDocument {
                    title: "画",
                    file_name: "art.pdf",
                    content_hash: "hash-of-art",
                    analysis: &analysis(&[("画", 1)]),
                    sections: &[],
                    cover: Some(&cover),
                },
                now(),
            )
            .unwrap();

        assert!(!store.document(without).unwrap().has_cover);
        assert!(store.document(with).unwrap().has_cover);
        assert_eq!(store.cover(with).unwrap(), Some(cover));

        store.delete_document(with).unwrap();
        assert_eq!(store.cover(with).unwrap(), None);
    }

    #[test]
    fn summarises_coverage_from_word_statuses() {
        let (mut store, id) = store_with_document();
        store.set_status("的", WordStatus::Known, now()).unwrap();
        store
            .set_status("学习", WordStatus::Learning, now())
            .unwrap();

        let summary = store.document(id).unwrap();
        assert_eq!(
            (
                summary.total_tokens,
                summary.unique_words,
                summary.known_tokens
            ),
            (100, 4, 50)
        );
        assert_eq!((summary.learning_tokens, summary.unseen_words), (15, 2));
        assert_eq!(store.documents().unwrap(), [summary]);
        assert_eq!(unseen(&store, id), ["我们", "中文"]);
    }

    #[test]
    fn lists_tracked_words_most_recently_changed_first() {
        let mut store = Store::open_in_memory().unwrap();
        store.import_known(&["的".to_owned()], now()).unwrap();
        let later = now() + chrono::Duration::hours(1);
        store
            .set_status("学习", WordStatus::Learning, later)
            .unwrap();
        assert_eq!(
            store.tracked_words().unwrap(),
            [
                TrackedWord {
                    word: "学习".into(),
                    status: WordStatus::Learning,
                    due_at: Some(later.timestamp_millis()),
                    updated_at: later.timestamp_millis(),
                },
                TrackedWord {
                    word: "的".into(),
                    status: WordStatus::Known,
                    due_at: None,
                    updated_at: now().timestamp_millis(),
                },
            ]
        );
    }

    #[test]
    fn counts_words_needed_for_a_coverage_target() {
        let (mut store, id) = store_with_document();
        assert_eq!(store.words_to_reach(id, 0.5).unwrap(), 1);
        assert_eq!(store.words_to_reach(id, 0.95).unwrap(), 3);
        assert_eq!(store.words_to_reach(id, 1.0).unwrap(), 4);
        store.set_status("的", WordStatus::Known, now()).unwrap();
        assert_eq!(store.words_to_reach(id, 0.5).unwrap(), 0);
        assert_eq!(store.words_to_reach(id, 0.95).unwrap(), 2);
    }

    #[test]
    fn keeps_sections_and_the_reading_position() {
        let mut store = Store::open_in_memory().unwrap();
        let sections = [
            Section {
                title: None,
                text: "序。".into(),
            },
            Section {
                title: Some("第一章".into()),
                text: "第一章\n我们学习。".into(),
            },
        ];
        let id = store
            .add_document(
                &NewDocument {
                    title: "书",
                    file_name: "b.txt",
                    content_hash: "hash",
                    analysis: &analysis(&[]),
                    sections: &sections,
                    cover: None,
                },
                now(),
            )
            .unwrap();

        assert_eq!(
            store.section_titles(id).unwrap(),
            [None, Some("第一章".into())]
        );
        assert_eq!(store.section(id, 1).unwrap(), sections[1]);
        assert!(matches!(
            store.section(id, 2),
            Err(Error::SectionNotFound(_, 2))
        ));

        let summary = store.document(id).unwrap();
        assert_eq!((summary.reading_section, summary.reading_paragraph), (0, 0));
        store.set_reading_position(id, 1, 7).unwrap();
        let summary = store.document(id).unwrap();
        assert_eq!((summary.reading_section, summary.reading_paragraph), (1, 7));
        assert!(matches!(
            store.set_reading_position(id + 1, 0, 0),
            Err(Error::DocumentNotFound(_))
        ));

        store.delete_document(id).unwrap();
        assert!(matches!(
            store.section_titles(id),
            Err(Error::DocumentNotFound(_))
        ));
    }

    #[test]
    fn looks_up_the_status_of_known_and_learning_words_only() {
        let (mut store, _) = store_with_document();
        store.set_status("我们", WordStatus::Known, now()).unwrap();
        store
            .set_status("学习", WordStatus::Learning, now())
            .unwrap();
        let words = ["我们", "学习", "中文"].map(String::from);
        assert_eq!(
            store.statuses(&words).unwrap(),
            HashMap::from([
                ("我们".to_owned(), WordStatus::Known),
                ("学习".to_owned(), WordStatus::Learning),
            ])
        );
    }

    #[test]
    fn restores_a_word_after_undo() {
        let (mut store, id) = store_with_document();
        let first = store
            .set_status("我们", WordStatus::Learning, now())
            .unwrap();
        assert_eq!(first.previous, None);
        let second = store.set_status("我们", WordStatus::Known, now()).unwrap();
        assert_eq!(
            second.previous.as_ref().map(|p| p.status),
            Some(WordStatus::Learning)
        );

        store.restore(&second).unwrap();
        assert_eq!(store.counts(now()).unwrap().learning, 1);
        store.restore(&first).unwrap();
        assert_eq!(unseen(&store, id), ["的", "我们", "学习", "中文"]);
    }

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

    #[test]
    fn schedules_reviews_with_fsrs() {
        let (mut store, _) = store_with_document();
        store
            .set_status("学习", WordStatus::Learning, now())
            .unwrap();
        store
            .set_status("中文", WordStatus::Learning, now() - Duration::hours(1))
            .unwrap();
        assert_eq!(due(&store, now()), ["中文", "学习"]);

        let again = store.review("中文", 1, now()).unwrap().due_at;
        let good = store.review("学习", 3, now()).unwrap().due_at;
        assert!(again > now().timestamp_millis());
        assert!(good > again);
        assert!(due(&store, now()).is_empty());
        assert_eq!(store.next_due_at().unwrap(), Some(again));
        let later = Utc.timestamp_millis_opt(again).unwrap();
        assert_eq!(due(&store, later), ["中文"]);
        assert_eq!(
            store.counts(later).unwrap(),
            WordCounts {
                known: 0,
                learning: 2,
                due: 1
            }
        );
    }

    #[test]
    fn previews_each_rating_and_undoes_a_review() {
        let (mut store, _) = store_with_document();
        store
            .set_status("中文", WordStatus::Learning, now())
            .unwrap();
        let [again, hard, good, easy] = store.due_words(now(), 10).unwrap()[0].intervals;
        assert!(0 < again && again <= hard && hard <= good && good < easy);

        let reviewed = store.review("中文", 3, now()).unwrap();
        assert_eq!(reviewed.due_at, now().timestamp_millis() + good);
        assert!(due(&store, now()).is_empty());

        store.undo_review(&reviewed.snapshot).unwrap();
        assert_eq!(due(&store, now()), ["中文"]);
        assert!(store.reviews_since(0).unwrap().is_empty());
    }

    #[test]
    fn rejects_reviews_of_words_not_being_learned() {
        let (mut store, _) = store_with_document();
        assert!(matches!(
            store.review("我们", 3, now()),
            Err(Error::NotLearning(_))
        ));
        store
            .set_status("我们", WordStatus::Learning, now())
            .unwrap();
        assert!(matches!(
            store.review("我们", 5, now()),
            Err(Error::InvalidRating(5))
        ));
    }

    #[test]
    fn imports_known_words_and_counts_only_new_ones() {
        let (mut store, id) = store_with_document();
        store
            .set_status("学习", WordStatus::Learning, now())
            .unwrap();
        let words = ["的".to_owned(), "学习".to_owned(), "电脑".to_owned()];
        assert_eq!(store.import_known(&words, now()).unwrap(), 3);
        assert_eq!(store.import_known(&words, now()).unwrap(), 0);
        assert_eq!(
            store.counts(now()).unwrap(),
            WordCounts {
                known: 3,
                learning: 0,
                due: 0
            }
        );
        assert_eq!(unseen(&store, id), ["我们", "中文"]);
    }

    #[test]
    fn deletes_documents_with_their_words_but_keeps_word_progress() {
        let (mut store, id) = store_with_document();
        store.set_status("的", WordStatus::Known, now()).unwrap();
        store.delete_document(id).unwrap();
        assert!(store.documents().unwrap().is_empty());
        assert!(matches!(
            store.document(id),
            Err(Error::DocumentNotFound(_))
        ));
        assert!(matches!(
            store.delete_document(id),
            Err(Error::DocumentNotFound(_))
        ));
        assert_eq!(store.counts(now()).unwrap().known, 1);
        assert_eq!(store.example_for("的").unwrap(), None);
    }

    fn add(store: &mut Store, title: &str) -> i64 {
        store
            .add_document(
                &NewDocument {
                    title,
                    file_name: "b.txt",
                    content_hash: title,
                    analysis: &analysis(&[("书", 1)]),
                    sections: &[],
                    cover: None,
                },
                now(),
            )
            .unwrap()
    }

    fn folder_of(store: &Store, id: i64) -> Option<i64> {
        store.document(id).unwrap().folder_id
    }

    #[test]
    fn groups_books_into_named_folders_that_vanish_once_empty() {
        let (mut store, first) = store_with_document();
        let second = add(&mut store, "二");
        let third = add(&mut store, "三");

        let folder = store
            .create_folder("  小说 ", &[first, second], now())
            .unwrap();
        assert_eq!(folder.name, "小说");
        assert_eq!(store.folders().unwrap(), std::slice::from_ref(&folder));
        assert_eq!(folder_of(&store, first), Some(folder.id));
        assert_eq!(folder_of(&store, third), None);

        store.move_document(third, Some(folder.id)).unwrap();
        store.rename_folder(folder.id, "科幻").unwrap();
        assert_eq!(store.folders().unwrap()[0].name, "科幻");

        store.move_document(first, None).unwrap();
        store.delete_document(second).unwrap();
        assert_eq!(store.folders().unwrap().len(), 1);
        store.move_document(third, None).unwrap();
        assert!(store.folders().unwrap().is_empty());
        assert_eq!(folder_of(&store, third), None);
    }

    #[test]
    fn moving_the_last_two_books_into_a_new_folder_drops_the_old_one() {
        let (mut store, first) = store_with_document();
        let second = add(&mut store, "二");
        let old = store.create_folder("旧", &[first, second], now()).unwrap();
        let new = store.create_folder("新", &[first, second], now()).unwrap();
        assert_eq!(store.folders().unwrap(), [new]);
        assert!(matches!(
            store.rename_folder(old.id, "x"),
            Err(Error::FolderNotFound(_))
        ));
    }

    #[test]
    fn rejects_unnamed_folders_lone_books_and_unknown_ids() {
        let (mut store, first) = store_with_document();
        let second = add(&mut store, "二");
        assert!(matches!(
            store.create_folder(" ", &[first, second], now()),
            Err(Error::EmptyFolderName)
        ));
        assert!(matches!(
            store.create_folder("书", &[first], now()),
            Err(Error::TooFewBooksForFolder)
        ));
        assert!(matches!(
            store.create_folder("书", &[first, 99], now()),
            Err(Error::DocumentNotFound(99))
        ));
        assert!(store.folders().unwrap().is_empty());
        assert!(matches!(
            store.move_document(first, Some(99)),
            Err(Error::FolderNotFound(99))
        ));
        let folder = store.create_folder("书", &[first, second], now()).unwrap();
        assert!(matches!(
            store.rename_folder(folder.id, ""),
            Err(Error::EmptyFolderName)
        ));
    }

    #[test]
    fn finds_examples_across_documents() {
        let (store, _) = store_with_document();
        assert_eq!(
            store.example_for("中文").unwrap().as_deref(),
            Some("中文的例句。")
        );
    }
}
