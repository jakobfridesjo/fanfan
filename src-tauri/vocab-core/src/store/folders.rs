use chrono::{DateTime, Utc};
use rusqlite::{Connection, params};

use super::{Folder, Store};
use crate::error::{Error, Result};

impl Store {
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

pub(super) fn delete_empty_folders(connection: &Connection) -> Result<()> {
    connection.execute(
        "DELETE FROM folders WHERE id NOT IN
           (SELECT folder_id FROM documents WHERE folder_id IS NOT NULL)",
        [],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::NewDocument;
    use crate::store::test_support::*;

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
}
