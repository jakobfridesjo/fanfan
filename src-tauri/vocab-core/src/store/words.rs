use std::collections::HashMap;
use std::ops::ControlFlow;

use chrono::{DateTime, Utc};
use rs_fsrs::{Card, FSRS, Rating};
use rusqlite::{Connection, OptionalExtension, params};

use super::{
    DocumentWord, DueWord, ReviewSnapshot, Reviewed, Store, StoredWord, TrackedWord, WordCounts,
    WordSnapshot, WordStatus,
};
use crate::error::{Error, Result};

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

impl Store {
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
        let rating = usize::from(rating)
            .checked_sub(1)
            .and_then(|index| RATINGS.get(index))
            .copied()
            .ok_or(Error::InvalidRating(rating))?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_support::*;
    use chrono::{Duration, TimeZone};

    fn due(store: &Store, at: DateTime<Utc>) -> Vec<String> {
        store
            .due_words(at, 10)
            .unwrap()
            .into_iter()
            .map(|w| w.word)
            .collect()
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
    fn finds_examples_across_documents() {
        let (store, _) = store_with_document();
        assert_eq!(
            store.example_for("中文").unwrap().as_deref(),
            Some("中文的例句。")
        );
    }
}
