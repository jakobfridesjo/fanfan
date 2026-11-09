use std::io::Read;
use std::path::Path;

use chrono::{DateTime, Utc};
use jieba_rs::Jieba;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::analysis::{Analysis, Piece, analyze, tokenize};
use crate::cangjie::cangjie_of;
use crate::dictionary::{Dictionary, Entry, Script};
use crate::error::{Error, Result};
use crate::extract::{Cover, Section, extract};
use crate::levels::levels_of;
use crate::store::{
    DocumentSummary, DocumentWord, DueWord, NewDocument, Store, TrackedWord, WordStatus,
};

/// Readings shown per card; CC-CEDICT lists rare ones and names after common ones.
const MAX_READINGS: usize = 3;

pub struct Language {
    pub dictionary: Dictionary,
    pub jieba: Jieba,
}

impl Language {
    pub fn load(cedict: impl Read) -> Result<Self> {
        Ok(Self {
            dictionary: Dictionary::read(cedict)?,
            jieba: Jieba::new(),
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportStage {
    Reading,
    Analyzing,
    Saving,
}

pub struct AnalyzedFile {
    pub title: String,
    pub content_hash: String,
    pub cover: Option<Cover>,
    pub file_name: String,
    pub sections: Vec<Section>,
    pub analysis: Analysis,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyCard {
    /// The word as the store knows it, in the document's own script.
    pub word: String,
    /// `word` in the script the learner reads.
    pub display_word: String,
    /// The traditional form beside `display_word` when the learner reads both.
    pub alternate_word: Option<String>,
    /// `display_word`'s Cangjie codes, one per character; null when a character has none.
    pub cangjie: Option<String>,
    /// `alternate_word`'s Cangjie codes.
    pub alternate_cangjie: Option<String>,
    pub readings: Vec<Entry>,
    /// In the script the learner reads.
    pub example: String,
    /// How often the word occurs in the document; absent outside a document.
    pub count: Option<u32>,
    /// HSK 3.0, 1 to 7, where 7 stands for levels 7-9.
    pub hsk_level: Option<u8>,
    /// TBCL, 1 to 7.
    pub tbcl_level: Option<u8>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Deck {
    pub document: DocumentSummary,
    pub cards: Vec<StudyCard>,
}

/// A run of a section's text as the reader shows it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderToken {
    /// In the script the learner reads.
    pub text: String,
    /// The traditional form above `text` when the learner reads both.
    pub alternate: Option<String>,
    /// The word as the store knows it; `None` for punctuation and other non-Chinese text.
    pub word: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderSection {
    pub position: u32,
    /// In the script the learner reads.
    pub title: Option<String>,
    pub paragraphs: Vec<Vec<ReaderToken>>,
    /// The section in reading order as stretches short enough to speak in one go.
    pub phrases: Vec<SpokenPhrase>,
}

/// Tokens `start..end` of one paragraph, read aloud together.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpokenPhrase {
    pub paragraph: u32,
    pub start: u32,
    pub end: u32,
    /// The tokens as the book has them, for `speak`: the audio is the same in either script.
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewQueue {
    pub cards: Vec<ReviewCard>,
    pub due_count: u32,
    pub next_due_at: Option<i64>,
}

/// A due word, with how far each rating, again to easy, would put off its next review (ms).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewCard {
    #[serde(flatten)]
    pub card: StudyCard,
    pub intervals: [i64; 4],
}

/// A known or learning word as the word list shows it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordEntry {
    /// The word as the store knows it: the key for status commands.
    pub word: String,
    /// `word` in the script the learner reads.
    pub display_word: String,
    /// The traditional form beside `display_word` when the learner reads both.
    pub alternate_word: Option<String>,
    pub readings: Vec<Entry>,
    pub status: WordStatus,
    pub due_at: Option<i64>,
    pub updated_at: i64,
    /// HSK 3.0, 1 to 7, where 7 stands for levels 7-9.
    pub hsk_level: Option<u8>,
    /// TBCL, 1 to 7.
    pub tbcl_level: Option<u8>,
}

/// The SHA-256 of the file's bytes, which tells a re-import of the same file apart.
pub fn content_hash(path: &Path) -> Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// Reads and analyses a file; the slow part of an import, done without the store.
pub fn analyze_file(
    path: &Path,
    content_hash: String,
    language: &Language,
    mut progress: impl FnMut(ImportStage),
) -> Result<AnalyzedFile> {
    progress(ImportStage::Reading);
    let extracted = extract(path)?;
    progress(ImportStage::Analyzing);
    let analysis = analyze(&extracted.text(), &language.jieba, &language.dictionary);
    if analysis.total_tokens == 0 {
        return Err(Error::NoChineseText);
    }
    let file_name = path
        .file_name()
        .map_or_else(String::new, |name| name.to_string_lossy().into_owned());
    Ok(AnalyzedFile {
        title: extracted.title,
        content_hash,
        cover: extracted.cover,
        file_name,
        sections: extracted.sections,
        analysis,
    })
}

pub fn save_file(
    store: &mut Store,
    file: &AnalyzedFile,
    now: DateTime<Utc>,
) -> Result<DocumentSummary> {
    let id = store.add_document(
        &NewDocument {
            title: &file.title,
            file_name: &file.file_name,
            content_hash: &file.content_hash,
            analysis: &file.analysis,
            sections: &file.sections,
            cover: file.cover.as_ref(),
        },
        now,
    )?;
    store.document(id)
}

// Each view below is read from the store first (a `*_source` or a store
// call) and then built without it, so the store's lock is not held while
// text is segmented or converted.

/// What a deck is built from.
pub struct DeckSource {
    pub document: DocumentSummary,
    pub words: Vec<DocumentWord>,
}

pub fn deck_source(store: &Store, document_id: i64, limit: u32) -> Result<DeckSource> {
    store.snapshot(|store| {
        Ok(DeckSource {
            document: store.document(document_id)?,
            words: store.unseen_words(document_id, Some(limit))?,
        })
    })
}

pub fn deck(source: DeckSource, dictionary: &Dictionary, script: Script) -> Deck {
    let cards = source
        .words
        .into_iter()
        .map(|word| {
            study_card(
                dictionary,
                script,
                word.word,
                &word.example,
                Some(word.count),
            )
        })
        .collect();
    Deck {
        document: source.document,
        cards,
    }
}

/// One section split into words the way its deck counted them, a paragraph per line.
pub fn reader_section(
    section: Section,
    language: &Language,
    position: u32,
    script: Script,
) -> ReaderSection {
    let dictionary = &language.dictionary;
    let mut phrases = Vec::new();
    let paragraphs = section
        .text
        .lines()
        .enumerate()
        .map(|(index, paragraph)| {
            let pieces = tokenize(paragraph, &language.jieba, dictionary);
            phrases.extend(spoken_phrases(index as u32, &pieces));
            pieces
                .into_iter()
                .map(|piece| ReaderToken {
                    text: if piece.is_word {
                        dictionary.write_in(piece.text, script)
                    } else {
                        piece.text.to_owned()
                    },
                    alternate: piece
                        .is_word
                        .then(|| dictionary.alternate_in(piece.text, script))
                        .flatten(),
                    word: piece.is_word.then(|| piece.text.to_owned()),
                })
                .collect()
        })
        .collect();
    ReaderSection {
        position,
        title: section
            .title
            .map(|title| dictionary.write_in(&title, script)),
        paragraphs,
        phrases,
    }
}

/// Speech gets slow and unsteady past this, so a longer sentence is also split at a pause.
const PHRASE_MAX_CHARS: usize = 30;

/// Splits a paragraph after each sentence end, and after a comma once the
/// phrase is long; a closing quote stays with its sentence. Phrases without
/// a word, such as a lone quote, are left out: there is nothing to say.
fn spoken_phrases(paragraph: u32, pieces: &[Piece]) -> Vec<SpokenPhrase> {
    const ENDS: &str = "。！？!?；;…";
    const PAUSES: &str = "，,、：:";
    const CLOSERS: &str = "。！？!?…”’」』）)\"";

    let mut phrases = Vec::new();
    let mut start = 0;
    let mut chars = 0;
    let mut ending = false;
    let mut finish = |start: usize, end: usize| {
        let tokens = &pieces[start..end];
        if tokens.iter().any(|piece| piece.is_word) {
            phrases.push(SpokenPhrase {
                paragraph,
                start: start as u32,
                end: end as u32,
                text: tokens.iter().map(|piece| piece.text).collect(),
            });
        }
    };
    for (index, piece) in pieces.iter().enumerate() {
        let closes = !piece.is_word && piece.text.trim().chars().all(|c| CLOSERS.contains(c));
        if ending && !closes {
            finish(start, index);
            start = index;
            chars = 0;
        }
        chars += piece.text.chars().count();
        ending = !piece.is_word
            && (piece.text.chars().any(|c| ENDS.contains(c))
                || (chars >= PHRASE_MAX_CHARS && piece.text.chars().any(|c| PAUSES.contains(c)))
                || (ending && closes));
    }
    finish(start, pieces.len());
    phrases
}

/// Every section's title in reading order, in the script the learner reads.
pub fn section_titles(
    titles: Vec<Option<String>>,
    dictionary: &Dictionary,
    script: Script,
) -> Vec<Option<String>> {
    titles
        .into_iter()
        .map(|title| title.map(|title| dictionary.write_in(&title, script)))
        .collect()
}

/// What a review queue is built from.
pub struct ReviewSource {
    pub words: Vec<DueWord>,
    pub due_count: u32,
    pub next_due_at: Option<i64>,
}

pub fn review_source(store: &Store, now: DateTime<Utc>, limit: u32) -> Result<ReviewSource> {
    store.snapshot(|store| {
        Ok(ReviewSource {
            words: store.due_words(now, limit)?,
            due_count: store.counts(now)?.due,
            next_due_at: store.next_due_at()?,
        })
    })
}

pub fn review_queue(source: ReviewSource, dictionary: &Dictionary, script: Script) -> ReviewQueue {
    let cards = source
        .words
        .into_iter()
        .map(|due| {
            let example = due.example.unwrap_or_default();
            ReviewCard {
                card: study_card(dictionary, script, due.word, &example, None),
                intervals: due.intervals,
            }
        })
        .collect();
    ReviewQueue {
        cards,
        due_count: source.due_count,
        next_due_at: source.next_due_at,
    }
}

/// A word looked up on its own; `example` is [`Store::example_for`] the word.
pub fn word_card(
    dictionary: &Dictionary,
    word: String,
    example: Option<String>,
    script: Script,
) -> StudyCard {
    study_card(dictionary, script, word, &example.unwrap_or_default(), None)
}

pub fn word_list(
    words: Vec<TrackedWord>,
    dictionary: &Dictionary,
    script: Script,
) -> Vec<WordEntry> {
    words
        .into_iter()
        .map(|tracked| {
            let levels = levels_of(&tracked.word);
            WordEntry {
                display_word: dictionary.write_in(&tracked.word, script),
                alternate_word: dictionary.alternate_in(&tracked.word, script),
                readings: readings(dictionary, &tracked.word),
                word: tracked.word,
                status: tracked.status,
                due_at: tracked.due_at,
                updated_at: tracked.updated_at,
                hsk_level: levels.hsk,
                tbcl_level: levels.tbcl,
            }
        })
        .collect()
}

fn readings(dictionary: &Dictionary, word: &str) -> Vec<Entry> {
    dictionary
        .lookup(word)
        .iter()
        .take(MAX_READINGS)
        .cloned()
        .collect()
}

fn study_card(
    dictionary: &Dictionary,
    script: Script,
    word: String,
    example: &str,
    count: Option<u32>,
) -> StudyCard {
    let levels = levels_of(&word);
    let display_word = dictionary.write_in(&word, script);
    let alternate_word = dictionary.alternate_in(&word, script);
    StudyCard {
        cangjie: cangjie_of(&display_word),
        alternate_cangjie: alternate_word.as_deref().and_then(cangjie_of),
        display_word,
        alternate_word,
        readings: readings(dictionary, &word),
        example: dictionary.write_in(example, script),
        word,
        count,
        hsk_level: levels.hsk,
        tbcl_level: levels.tbcl,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dictionary::tests::SAMPLE;
    use chrono::TimeZone;

    fn language() -> Language {
        Language {
            dictionary: Dictionary::parse(SAMPLE),
            jieba: Jieba::new(),
        }
    }

    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap()
    }

    /// A file in its own temporary directory, removed when dropped.
    struct TempFile {
        _directory: tempfile::TempDir,
        path: std::path::PathBuf,
    }

    impl std::ops::Deref for TempFile {
        type Target = Path;

        fn deref(&self) -> &Path {
            &self.path
        }
    }

    fn write(name: &str, text: &str) -> TempFile {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(name);
        std::fs::write(&path, text).unwrap();
        TempFile {
            _directory: directory,
            path,
        }
    }

    fn analyze(path: &Path, language: &Language) -> AnalyzedFile {
        analyze_file(path, content_hash(path).unwrap(), language, |_| {}).unwrap()
    }

    #[test]
    fn hashes_files_by_their_bytes() {
        let first = content_hash(&write("one.txt", "我们")).unwrap();
        assert_eq!(first, content_hash(&write("renamed.txt", "我们")).unwrap());
        assert_ne!(first, content_hash(&write("other.txt", "你们")).unwrap());
        assert_eq!(first.len(), 64);
    }

    #[test]
    fn imports_a_file_into_a_ranked_deck() {
        let language = language();
        let mut stages = Vec::new();
        let path = write("小说.txt", "我们在北京学习中文。我们很好。");
        let file = analyze_file(&path, content_hash(&path).unwrap(), &language, |stage| {
            stages.push(stage)
        })
        .unwrap();
        assert_eq!(stages, [ImportStage::Reading, ImportStage::Analyzing]);

        let mut store = Store::open_in_memory().unwrap();
        let summary = save_file(&mut store, &file, now()).unwrap();
        assert_eq!(
            (summary.title.as_str(), summary.file_name.as_str()),
            ("小说", "小说.txt")
        );

        store.set_status("我们", WordStatus::Known, now()).unwrap();
        let deck = deck(
            deck_source(&store, summary.id, 2).unwrap(),
            &language.dictionary,
            Script::Simplified,
        );
        let words: Vec<&str> = deck.cards.iter().map(|card| card.word.as_str()).collect();
        assert_eq!(words, ["在", "北京"]);
        assert_eq!(deck.cards[1].readings[0].pinyin, "Běi jīng");
        assert_eq!(deck.cards[1].example, "我们在北京学习中文。");
        assert_eq!(deck.document.known_tokens, 2);
    }

    #[test]
    fn reads_a_section_as_the_words_its_deck_counted() {
        let language = language();
        let mut store = Store::open_in_memory().unwrap();
        let path = write(
            "读.txt",
            "序言。\n第一章\n　　我们学习中文，很好。\n\n他说：“发。”",
        );
        let summary = save_file(&mut store, &analyze(&path, &language), now()).unwrap();

        let section = reader_section(
            store.section(summary.id, 1).unwrap(),
            &language,
            1,
            Script::Traditional,
        );
        assert_eq!(section.title.as_deref(), Some("第一章"));
        let paragraphs: Vec<Vec<(&str, Option<&str>)>> = section
            .paragraphs
            .iter()
            .map(|tokens| {
                tokens
                    .iter()
                    .map(|token| (token.text.as_str(), token.word.as_deref()))
                    .collect()
            })
            .collect();
        assert_eq!(
            paragraphs[1],
            [
                ("我們", Some("我们")),
                ("學習", Some("学习")),
                ("中文", Some("中文")),
                ("，", None),
                ("很", Some("很")),
                ("好", Some("好")),
                ("。", None),
            ]
        );
        assert_eq!(paragraphs.len(), 3);
        let phrases: Vec<(u32, u32, u32, &str)> = section
            .phrases
            .iter()
            .map(|phrase| {
                (
                    phrase.paragraph,
                    phrase.start,
                    phrase.end,
                    phrase.text.as_str(),
                )
            })
            .collect();
        assert_eq!(
            phrases,
            [
                (0, 0, 3, "第一章"),
                (1, 0, 7, "我们学习中文，很好。"),
                (2, 0, 7, "他说：“发。”"),
            ]
        );

        let card = word_card(
            &language.dictionary,
            "学习".into(),
            store.example_for("学习").unwrap(),
            Script::Traditional,
        );
        assert_eq!(card.display_word, "學習");
        assert_eq!(card.example, "我們學習中文，很好。");
        assert_eq!(card.readings[0].pinyin, "xué xí");

        let titles = section_titles(
            store.section_titles(summary.id).unwrap(),
            &language.dictionary,
            Script::Simplified,
        );
        assert_eq!(titles, [None, Some("第一章".to_owned())]);
    }

    #[test]
    fn refuses_files_without_chinese() {
        let path = write("english.txt", "Only English here.");
        assert!(matches!(
            analyze_file(&path, String::new(), &language(), |_| {}),
            Err(Error::NoChineseText)
        ));
    }

    #[test]
    fn builds_the_review_queue_with_examples() {
        let language = language();
        let mut store = Store::open_in_memory().unwrap();
        let file = analyze(&write("a.txt", "我们学习中文。"), &language);
        save_file(&mut store, &file, now()).unwrap();
        store
            .set_status("中文", WordStatus::Learning, now())
            .unwrap();

        let queue_in = |script| {
            review_queue(
                review_source(&store, now(), 10).unwrap(),
                &language.dictionary,
                script,
            )
        };
        let queue = queue_in(Script::Simplified);
        assert_eq!(queue.due_count, 1);
        assert_eq!(queue.next_due_at, Some(now().timestamp_millis()));
        assert_eq!(queue.cards[0].card.word, "中文");
        assert_eq!(queue.cards[0].card.example, "我们学习中文。");
        assert_eq!(queue.cards[0].card.count, None);

        let traditional = queue_in(Script::Traditional);
        let card = &traditional.cards[0].card;
        assert_eq!(
            (
                card.word.as_str(),
                card.display_word.as_str(),
                card.example.as_str()
            ),
            ("中文", "中文", "我們學習中文。")
        );
    }

    #[test]
    fn shows_both_scripts_as_simplified_with_traditional_beside_it() {
        let language = language();
        let mut store = Store::open_in_memory().unwrap();
        let file = analyze(&write("both.txt", "我們學習中文。"), &language);
        let summary = save_file(&mut store, &file, now()).unwrap();

        let card = word_card(
            &language.dictionary,
            "學習".into(),
            store.example_for("學習").unwrap(),
            Script::Both,
        );
        assert_eq!(
            (
                card.display_word.as_str(),
                card.alternate_word.as_deref(),
                card.example.as_str()
            ),
            ("学习", Some("學習"), "我们学习中文。")
        );

        let section = reader_section(
            store.section(summary.id, 0).unwrap(),
            &language,
            0,
            Script::Both,
        );
        let tokens: Vec<(&str, Option<&str>)> = section.paragraphs[0]
            .iter()
            .map(|token| (token.text.as_str(), token.alternate.as_deref()))
            .collect();
        assert_eq!(
            tokens,
            [
                ("我们", Some("我們")),
                ("学习", Some("學習")),
                ("中文", None),
                ("。", None)
            ]
        );
    }

    /// The field names `src/shared/api/commands.ts` reads.
    #[test]
    fn serializes_decks_and_queues_with_the_frontend_field_names() {
        let language = language();
        let mut store = Store::open_in_memory().unwrap();
        let file = analyze(&write("b.txt", "我们学习中文。"), &language);
        let summary = save_file(&mut store, &file, now()).unwrap();
        let keys = |value: serde_json::Value| -> Vec<String> {
            let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
            keys.sort();
            keys
        };

        let deck = serde_json::to_value(deck(
            deck_source(&store, summary.id, 5).unwrap(),
            &language.dictionary,
            Script::Simplified,
        ))
        .unwrap();
        assert_eq!(keys(deck.clone()), ["cards", "document"]);
        assert_eq!(
            keys(deck["document"].clone()),
            [
                "addedAt",
                "fileName",
                "folderId",
                "hasCover",
                "id",
                "knownTokens",
                "learningTokens",
                "readingParagraph",
                "readingSection",
                "title",
                "totalTokens",
                "uniqueWords",
                "unseenWords"
            ]
        );
        let queue = review_queue(
            review_source(&store, now(), 5).unwrap(),
            &language.dictionary,
            Script::Simplified,
        );
        assert_eq!(
            keys(serde_json::to_value(queue).unwrap()),
            ["cards", "dueCount", "nextDueAt"]
        );
        let snapshot = store
            .set_status("中文", WordStatus::Learning, now())
            .unwrap();
        assert_eq!(
            keys(serde_json::to_value(snapshot).unwrap()),
            ["previous", "word"]
        );
        let queue = serde_json::to_value(review_queue(
            review_source(&store, now(), 5).unwrap(),
            &language.dictionary,
            Script::Simplified,
        ))
        .unwrap();
        assert_eq!(
            keys(queue["cards"][0].clone()),
            [
                "alternateCangjie",
                "alternateWord",
                "cangjie",
                "count",
                "displayWord",
                "example",
                "hskLevel",
                "intervals",
                "readings",
                "tbclLevel",
                "word"
            ]
        );
        let reviewed = store.review("中文", 3, now()).unwrap();
        assert_eq!(
            keys(serde_json::to_value(reviewed.snapshot).unwrap()),
            ["reviewId", "word"]
        );
        assert_eq!(
            serde_json::to_value(store.counts(now()).unwrap()).unwrap(),
            serde_json::json!({ "known": 0, "learning": 1, "due": 0 })
        );
        let statistics =
            serde_json::to_value(crate::statistics::statistics(&store, now(), 1).unwrap()).unwrap();
        assert_eq!(
            keys(statistics.clone()),
            [
                "counts",
                "dueForecast",
                "retention",
                "reviewsPerDay",
                "stability",
                "streak"
            ]
        );
        assert_eq!(
            keys(statistics["reviewsPerDay"][0].clone()),
            ["again", "date", "easy", "good", "hard"]
        );
        assert_eq!(
            keys(statistics["dueForecast"][0].clone()),
            ["count", "date"]
        );
        assert_eq!(keys(statistics["stability"][0].clone()), ["count", "key"]);
        let other = save_file(
            &mut store,
            &analyze(&write("c.txt", "我们学习。"), &language),
            now(),
        )
        .unwrap();
        let folder = store
            .create_folder("书", &[summary.id, other.id], now())
            .unwrap();
        assert_eq!(
            serde_json::to_value(&folder).unwrap(),
            serde_json::json!({ "id": folder.id, "name": "书" })
        );
        assert_eq!(
            serde_json::to_value(ImportStage::Analyzing).unwrap(),
            "analyzing"
        );
        assert_eq!(serde_json::to_value(WordStatus::Known).unwrap(), "known");
        let list = word_list(
            store.tracked_words().unwrap(),
            &language.dictionary,
            Script::Simplified,
        );
        assert_eq!(
            keys(serde_json::to_value(&list[0]).unwrap()),
            [
                "alternateWord",
                "displayWord",
                "dueAt",
                "hskLevel",
                "readings",
                "status",
                "tbclLevel",
                "updatedAt",
                "word"
            ]
        );
        let section = reader_section(
            store.section(summary.id, 0).unwrap(),
            &language,
            0,
            Script::Simplified,
        );
        let section = serde_json::to_value(section).unwrap();
        assert_eq!(
            keys(section.clone()),
            ["paragraphs", "phrases", "position", "title"]
        );
        assert_eq!(
            section["phrases"][0],
            serde_json::json!({ "paragraph": 0, "start": 0, "end": 4, "text": "我们学习中文。" })
        );
        assert_eq!(
            section["paragraphs"][0][0],
            serde_json::json!({ "text": "我们", "alternate": null, "word": "我们" })
        );
    }

    #[test]
    fn splits_long_sentences_at_a_pause_and_keeps_quotes_with_their_sentence() {
        let piece = |text| Piece {
            text,
            is_word: text.chars().any(crate::text::is_han),
        };
        let long = "很".repeat(PHRASE_MAX_CHARS);
        let pieces = [
            piece("他"),
            piece("说"),
            piece("："),
            piece("“"),
            piece("好"),
            piece("。"),
            piece("”"),
            piece(&long),
            piece("，"),
            piece("短"),
            piece("，"),
            piece("对"),
        ];
        let phrases: Vec<(u32, u32)> = spoken_phrases(2, &pieces)
            .iter()
            .map(|phrase| (phrase.start, phrase.end))
            .collect();
        assert_eq!(phrases, [(0, 7), (7, 9), (9, 12)]);
        assert_eq!(spoken_phrases(2, &pieces)[0].text, "他说：“好。”");
        assert!(spoken_phrases(0, &[piece("……")]).is_empty());
    }

    #[test]
    fn serializes_cards_for_the_frontend() {
        let card = StudyCard {
            word: "北京".into(),
            display_word: "北京".into(),
            alternate_word: None,
            cangjie: cangjie_of("北京"),
            alternate_cangjie: None,
            readings: language().dictionary.lookup("北京").to_vec(),
            example: "北京很好。".into(),
            count: Some(3),
            hsk_level: Some(1),
            tbcl_level: Some(2),
        };
        assert_eq!(
            serde_json::to_value(&card).unwrap(),
            serde_json::json!({
                "word": "北京",
                "displayWord": "北京",
                "alternateWord": null,
                "cangjie": "LMP YRF",
                "alternateCangjie": null,
                "readings": [{
                    "pinyin": "Běi jīng",
                    "zhuyin": "ㄅㄟˇ ㄐㄧㄥ",
                    "definitions": ["Beijing"],
                    "properNoun": true
                }],
                "example": "北京很好。",
                "count": 3,
                "hskLevel": 1,
                "tbclLevel": 2
            })
        );
    }
}
