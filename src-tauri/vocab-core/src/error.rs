#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Unsupported file type \"{0}\". Use a .txt, .epub or .pdf file.")]
    UnsupportedFile(String),
    #[error("Could not read the file: {0}")]
    Io(#[from] std::io::Error),
    #[error("Could not read the EPUB: {0}")]
    Epub(String),
    #[error("Could not read the PDF: {0}")]
    Pdf(String),
    #[error("The file contains no Chinese text")]
    NoChineseText,
    #[error("Could not load the dictionary: {0}")]
    Dictionary(String),
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Database migration failed: {0}")]
    Migration(#[from] rusqlite_migration::Error),
    #[error("Stored review data is unreadable: {0}")]
    StoredCard(#[from] serde_json::Error),
    #[error("\"{0}\" is already in the library")]
    AlreadyImported(String),
    #[error("Document {0} does not exist")]
    DocumentNotFound(i64),
    #[error("Document {0} has no section {1}")]
    SectionNotFound(i64, u32),
    #[error("Folder {0} does not exist")]
    FolderNotFound(i64),
    #[error("A book needs a title")]
    EmptyTitle,
    #[error("A folder needs a name")]
    EmptyFolderName,
    #[error("A folder needs at least two books")]
    TooFewBooksForFolder,
    #[error("\"{0}\" is not being learned")]
    NotLearning(String),
    #[error("Could not play the word: {0}")]
    Voice(String),
    #[error("Could not translate: {0}")]
    Translation(String),
    #[error("Could not download the model: {0}")]
    Download(String),
    #[error("Rating must be 1 (again) to 4 (easy), got {0}")]
    InvalidRating(u8),
}

pub type Result<T> = std::result::Result<T, Error>;
