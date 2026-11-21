use chrono::{DateTime, Utc};
use rusqlite::params;

use super::{Store, StoredBookmark};
use crate::error::{Error, Result};

/// Characters of the bookmarked paragraph shown to tell bookmarks apart.
const EXCERPT_CHARS: usize = 40;

impl Store {
    /// Bookmarks paragraph `paragraph` of section `section`; returns the bookmark's id,
    /// the existing one's when that paragraph is already bookmarked.
    pub fn add_bookmark(
        &mut self,
        document_id: i64,
        section: u32,
        paragraph: u32,
        now: DateTime<Utc>,
    ) -> Result<i64> {
        let has_section: bool = self.connection.query_row(
            "SELECT EXISTS (SELECT 1 FROM document_sections WHERE document_id = ?1 AND position = ?2)",
            params![document_id, section],
            |row| row.get(0),
        )?;
        if !has_section {
            self.ensure_document(document_id)?;
            return Err(Error::SectionNotFound(document_id, section));
        }
        Ok(self.connection.query_row(
            "INSERT INTO bookmarks (document_id, section, paragraph, created_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (document_id, section, paragraph) DO UPDATE SET id = id
             RETURNING id",
            params![document_id, section, paragraph, now.timestamp_millis()],
            |row| row.get(0),
        )?)
    }

    pub fn delete_bookmark(&mut self, id: i64) -> Result<()> {
        let deleted = self
            .connection
            .execute("DELETE FROM bookmarks WHERE id = ?1", [id])?;
        if deleted == 0 {
            return Err(Error::BookmarkNotFound(id));
        }
        Ok(())
    }

    /// The document's bookmarks in reading order.
    pub fn bookmarks(&self, document_id: i64) -> Result<Vec<StoredBookmark>> {
        self.ensure_document(document_id)?;
        let mut statement = self.connection.prepare(
            "SELECT b.id, b.section, b.paragraph, b.created_at, s.title, s.text
             FROM bookmarks b
             JOIN document_sections s ON s.document_id = b.document_id AND s.position = b.section
             WHERE b.document_id = ?1
             ORDER BY b.section, b.paragraph",
        )?;
        let bookmarks = statement
            .query_map([document_id], |row| {
                let paragraph: u32 = row.get(2)?;
                let text: String = row.get(5)?;
                Ok(StoredBookmark {
                    id: row.get(0)?,
                    section: row.get(1)?,
                    paragraph,
                    created_at: row.get(3)?,
                    section_title: row.get(4)?,
                    excerpt: excerpt(&text, paragraph),
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(bookmarks)
    }
}

/// The start of paragraph `paragraph`, counted the way the reader splits a section into lines.
fn excerpt(text: &str, paragraph: u32) -> String {
    let line = text
        .lines()
        .nth(paragraph as usize)
        .unwrap_or_default()
        .trim();
    let mut excerpt: String = line.chars().take(EXCERPT_CHARS).collect();
    if line.chars().nth(EXCERPT_CHARS).is_some() {
        excerpt.push('…');
    }
    excerpt
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::Section;
    use crate::store::NewDocument;
    use crate::store::test_support::*;

    fn store_with_sections() -> (Store, i64) {
        let mut store = Store::open_in_memory().unwrap();
        let long = "长".repeat(50);
        let id = store
            .add_document(
                &NewDocument {
                    title: "书",
                    file_name: "b.txt",
                    content_hash: "hash",
                    analysis: &analysis(&[]),
                    sections: &[
                        Section {
                            title: None,
                            text: "序。".into(),
                        },
                        Section {
                            title: Some("第一章".into()),
                            text: format!("第一章\n我们学习。\n{long}"),
                        },
                    ],
                    cover: None,
                },
                now(),
            )
            .unwrap();
        (store, id)
    }

    #[test]
    fn lists_bookmarks_in_reading_order_with_an_excerpt() {
        let (mut store, id) = store_with_sections();
        let later = store.add_bookmark(id, 1, 2, now()).unwrap();
        let earlier = store.add_bookmark(id, 1, 1, now()).unwrap();
        assert_eq!(store.add_bookmark(id, 1, 1, now()).unwrap(), earlier);

        let bookmarks = store.bookmarks(id).unwrap();
        assert_eq!(
            bookmarks.iter().map(|b| b.id).collect::<Vec<_>>(),
            [earlier, later]
        );
        assert_eq!(bookmarks[0].section_title.as_deref(), Some("第一章"));
        assert_eq!(bookmarks[0].excerpt, "我们学习。");
        assert_eq!(bookmarks[1].excerpt, format!("{}…", "长".repeat(40)));

        store.delete_bookmark(earlier).unwrap();
        assert_eq!(store.bookmarks(id).unwrap().len(), 1);
        assert!(matches!(
            store.delete_bookmark(earlier),
            Err(Error::BookmarkNotFound(_))
        ));
    }

    #[test]
    fn refuses_a_bookmark_outside_the_book_and_drops_them_with_it() {
        let (mut store, id) = store_with_sections();
        assert!(matches!(
            store.add_bookmark(id, 2, 0, now()),
            Err(Error::SectionNotFound(_, 2))
        ));
        assert!(matches!(
            store.add_bookmark(id + 1, 0, 0, now()),
            Err(Error::DocumentNotFound(_))
        ));

        store.add_bookmark(id, 0, 0, now()).unwrap();
        store.delete_document(id).unwrap();
        assert!(matches!(
            store.bookmarks(id),
            Err(Error::DocumentNotFound(_))
        ));
    }
}
