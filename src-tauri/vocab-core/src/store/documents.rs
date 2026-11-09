use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension, Row, params};

use super::folders::delete_empty_folders;
use super::{DocumentSummary, NewDocument, Store};
use crate::error::{Error, Result};
use crate::extract::{Cover, Section};

impl Store {
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
    use crate::store::WordStatus;
    use crate::store::test_support::*;

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
}
