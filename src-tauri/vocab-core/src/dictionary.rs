use std::collections::HashMap;
use std::io::Read;

use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::pinyin::{to_tone_marks, to_zhuyin};

/// The character set a word is shown in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Script {
    Simplified,
    Traditional,
    /// Simplified, with each word's traditional form beside it where it differs.
    Both,
}

/// The reading the reader writes above each character.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Notation {
    Pinyin,
    Zhuyin,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    #[serde(skip)]
    pub simplified: String,
    #[serde(skip)]
    pub traditional: String,
    pub pinyin: String,
    /// The same reading in zhuyin (bopomofo), as Taiwan writes it.
    pub zhuyin: String,
    pub definitions: Vec<String>,
    /// CC-CEDICT capitalises the pinyin of names and places.
    pub proper_noun: bool,
}

/// CC-CEDICT, keyed by both simplified and traditional headwords.
#[derive(Debug, Default)]
pub struct Dictionary {
    entries: HashMap<String, Vec<Entry>>,
    longest_word: usize,
}

impl Dictionary {
    /// Reads CC-CEDICT gzipped, as released, or plain: Android's asset
    /// packaging unpacks the bundled `.gz`.
    pub fn read(mut reader: impl Read) -> Result<Self> {
        let mut bytes = Vec::new();
        reader.read_to_end(&mut bytes)?;
        let text = if bytes.starts_with(&[0x1f, 0x8b]) {
            let mut text = String::new();
            GzDecoder::new(bytes.as_slice())
                .read_to_string(&mut text)
                .map_err(|error| Error::Dictionary(error.to_string()))?;
            text
        } else {
            String::from_utf8(bytes).map_err(|error| Error::Dictionary(error.to_string()))?
        };
        Ok(Self::parse(&text))
    }

    /// Parses lines like `傳統 传统 [chuan2 tong3] /tradition/traditional/`.
    pub fn parse(text: &str) -> Self {
        let mut dictionary = Self::default();
        for (traditional, simplified, entry) in text.lines().filter_map(parse_line) {
            if traditional != simplified {
                dictionary.insert(traditional, entry.clone());
            }
            dictionary.insert(simplified, entry);
        }
        for entries in dictionary.entries.values_mut() {
            entries.sort_by_key(|entry| {
                (
                    entry.proper_noun,
                    is_secondary(entry),
                    !is_particle(entry),
                    std::cmp::Reverse(entry.definitions.len()),
                )
            });
        }
        dictionary
    }

    fn insert(&mut self, word: &str, entry: Entry) {
        self.longest_word = self.longest_word.max(word.chars().count());
        self.entries.entry(word.to_owned()).or_default().push(entry);
    }

    pub fn lookup(&self, word: &str) -> &[Entry] {
        self.entries.get(word).map_or(&[], Vec::as_slice)
    }

    pub fn contains(&self, word: &str) -> bool {
        self.entries.contains_key(word)
    }

    /// `text` written in `script`, converting it word by word.
    pub fn write_in(&self, text: &str, script: Script) -> String {
        self.split_into_words(text)
            .into_iter()
            .map(|word| self.word_in(word, script))
            .collect()
    }

    /// `word`'s traditional form, when `script` shows both and it differs.
    pub fn alternate_in(&self, word: &str, script: Script) -> Option<String> {
        if script != Script::Both {
            return None;
        }
        let traditional = self.write_in(word, Script::Traditional);
        (traditional != self.write_in(word, Script::Simplified)).then_some(traditional)
    }

    /// `word`'s most likely reading in `notation`, one syllable per character;
    /// empty for a character the dictionary has no reading for.
    pub fn syllables_of(&self, word: &str, notation: Notation) -> Vec<String> {
        let whole = |word: &str| {
            self.lookup(word)
                .first()?
                .syllables(notation, word.chars().count())
        };
        whole(word).unwrap_or_else(|| {
            self.split_into_words(word)
                .into_iter()
                .flat_map(|part| {
                    whole(part).unwrap_or_else(|| vec![String::new(); part.chars().count()])
                })
                .collect()
        })
    }

    /// A word already written in `script` stays as it is; otherwise its most
    /// likely reading decides, since one simplified form can stand for several
    /// traditional ones (发: 發 or 髮).
    fn word_in<'a>(&'a self, word: &'a str, script: Script) -> &'a str {
        let entries = self.lookup(word);
        if entries.iter().any(|entry| entry.written_in(script) == word) {
            return word;
        }
        entries
            .first()
            .map_or(word, |entry| entry.written_in(script))
    }

    /// Greedy longest match against the dictionary, one character where nothing matches.
    pub fn split_into_words<'a>(&self, run: &'a str) -> Vec<&'a str> {
        let boundaries: Vec<usize> = run
            .char_indices()
            .map(|(index, _)| index)
            .chain(std::iter::once(run.len()))
            .collect();
        let mut words = Vec::new();
        let mut start = 0;
        while start + 1 < boundaries.len() {
            let longest = (start + 1..boundaries.len().min(start + self.longest_word + 1))
                .rev()
                .find(|&end| self.contains(&run[boundaries[start]..boundaries[end]]))
                .unwrap_or(start + 1);
            words.push(&run[boundaries[start]..boundaries[longest]]);
            start = longest;
        }
        words
    }
}

impl Entry {
    /// The reading in `notation` split into syllables, when it has one per character.
    fn syllables(&self, notation: Notation, characters: usize) -> Option<Vec<String>> {
        let reading = match notation {
            Notation::Pinyin => &self.pinyin,
            Notation::Zhuyin => &self.zhuyin,
        };
        let syllables: Vec<String> = reading.split(' ').map(str::to_owned).collect();
        (syllables.len() == characters).then_some(syllables)
    }

    fn written_in(&self, script: Script) -> &str {
        match script {
            Script::Simplified | Script::Both => &self.simplified,
            Script::Traditional => &self.traditional,
        }
    }
}

/// Readings that only point elsewhere or are marked as rare usage.
fn is_secondary(entry: &Entry) -> bool {
    const MARKERS: &[&str] = &[
        "variant of",
        "old variant of",
        "unofficial variant of",
        "archaic variant of",
        "used in ",
        "see ",
        "surname ",
        "(coll.)",
        "(dialect)",
        "(literary)",
        "(archaic)",
        "(old)",
    ];
    entry
        .definitions
        .iter()
        .all(|definition| MARKERS.iter().any(|marker| definition.starts_with(marker)))
}

/// Grammatical particles (了 le, 着 zhe, 吗 ma) are by far the most frequent
/// reading of their characters, though CC-CEDICT gives them few definitions.
fn is_particle(entry: &Entry) -> bool {
    entry
        .definitions
        .iter()
        .any(|definition| definition.contains("particle") || definition.contains("marker"))
}

fn parse_line(line: &str) -> Option<(&str, &str, Entry)> {
    if line.starts_with('#') {
        return None;
    }
    let (traditional, rest) = line.split_once(' ')?;
    let (simplified, rest) = rest.split_once(" [")?;
    let (pinyin, rest) = rest.split_once("] /")?;
    let definitions: Vec<String> = rest
        .split('/')
        .map(str::trim)
        .filter(|definition| !definition.is_empty())
        .map(str::to_owned)
        .collect();
    let entry = Entry {
        simplified: simplified.to_owned(),
        traditional: traditional.to_owned(),
        proper_noun: pinyin.starts_with(|c: char| c.is_ascii_uppercase()),
        pinyin: to_tone_marks(pinyin),
        zhuyin: to_zhuyin(pinyin),
        definitions,
    };
    Some((traditional, simplified, entry))
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub(crate) const SAMPLE: &str = r#"# CC-CEDICT sample
北京 北京 [Bei3 jing1] /Beijing/
北京大學 北京大学 [Bei3 jing1 Da4 xue2] /Peking University/
大學 大学 [da4 xue2] /university/
學習 学习 [xue2 xi2] /to learn/to study/
學 学 [xue2] /to learn/
發 发 [fa1] /to send out/to issue/to develop/
髮 发 [fa4] /hair/
頭髮 头发 [tou2 fa5] /hair (on the head)/
習 习 [xi2] /to practice/
中文 中文 [Zhong1 wen2] /Chinese language/
我們 我们 [wo3 men5] /we; us/
在 在 [zai4] /at; in/
的 的 [de5] /of; ~'s (possessive particle)/
了 了 [liao3] /to finish/(literary) completely/variant of 瞭|了[liao3]/
了 了 [le5] /(completed action marker)/
很 很 [hen3] /very/
好 好 [hao3] /good/
他 他 [ta1] /he; him/
說 说 [shui4] /to persuade/
說 说 [shuo1] /to speak/to say/
嗎 吗 [ma2] /(coll.) what?/
嗎 吗 [ma5] /(question particle for "yes-no" questions)/
不 不 [bu4] /no; not/
難 难 [nan2] /difficult/
明 明 [Ming2] /Ming dynasty/
明 明 [ming2] /bright/
小 小 [xiao3] /small/
"#;

    #[test]
    fn indexes_simplified_and_traditional_headwords() {
        let dictionary = Dictionary::parse(SAMPLE);
        assert_eq!(dictionary.lookup("学习"), dictionary.lookup("學習"));
        assert_eq!(
            dictionary.lookup("学习")[0].definitions,
            ["to learn", "to study"]
        );
        assert_eq!(dictionary.lookup("北京")[0].pinyin, "Běi jīng");
        assert!(dictionary.lookup("北京")[0].proper_noun);
        assert!(dictionary.lookup("没有").is_empty());
    }

    #[test]
    fn lists_the_most_likely_reading_first() {
        let dictionary = Dictionary::parse(SAMPLE);
        let readings = |word: &str| -> Vec<String> {
            dictionary
                .lookup(word)
                .iter()
                .map(|entry| entry.pinyin.clone())
                .collect()
        };
        assert_eq!(readings("明"), ["míng", "Míng"]);
        assert_eq!(readings("了"), ["le", "liǎo"]);
        assert_eq!(readings("说"), ["shuō", "shuì"]);
        assert_eq!(readings("吗"), ["ma", "má"]);
    }

    #[test]
    fn writes_text_in_either_script() {
        let dictionary = Dictionary::parse(SAMPLE);
        assert_eq!(
            dictionary.write_in("我们学习中文。", Script::Traditional),
            "我們學習中文。"
        );
        assert_eq!(
            dictionary.write_in("我們學習，OK", Script::Simplified),
            "我们学习，OK"
        );
        assert_eq!(dictionary.write_in("学习", Script::Simplified), "学习");
        assert_eq!(dictionary.write_in("发", Script::Traditional), "發");
        assert_eq!(dictionary.write_in("头发", Script::Traditional), "頭髮");
        assert_eq!(dictionary.write_in("髮", Script::Traditional), "髮");
        assert_eq!(dictionary.write_in("學習", Script::Both), "学习");
    }

    #[test]
    fn gives_the_traditional_form_only_when_showing_both_and_it_differs() {
        let dictionary = Dictionary::parse(SAMPLE);
        assert_eq!(
            dictionary.alternate_in("学习", Script::Both).as_deref(),
            Some("學習")
        );
        assert_eq!(dictionary.alternate_in("中文", Script::Both), None);
        assert_eq!(dictionary.alternate_in("学习", Script::Simplified), None);
    }

    #[test]
    fn reads_each_character_by_its_word() {
        let dictionary = Dictionary::parse(SAMPLE);
        assert_eq!(
            dictionary.syllables_of("头发", Notation::Pinyin),
            ["tóu", "fa"]
        );
        assert_eq!(
            dictionary.syllables_of("學習", Notation::Zhuyin),
            ["ㄒㄩㄝˊ", "ㄒㄧˊ"]
        );
        assert_eq!(dictionary.syllables_of("了", Notation::Pinyin), ["le"]);
        assert_eq!(
            dictionary.syllables_of("不难", Notation::Pinyin),
            ["bù", "nán"]
        );
        assert_eq!(
            dictionary.syllables_of("我们俩", Notation::Pinyin),
            ["wǒ", "men", ""]
        );
    }

    #[test]
    fn splits_unknown_runs_into_the_longest_known_words() {
        let dictionary = Dictionary::parse(SAMPLE);
        assert_eq!(dictionary.split_into_words("不难"), ["不", "难"]);
        assert_eq!(
            dictionary.split_into_words("北京大学学习"),
            ["北京大学", "学习"]
        );
        assert_eq!(dictionary.split_into_words("我们俩"), ["我们", "俩"]);
    }

    #[test]
    fn reads_the_gzipped_release() {
        let mut compressed = Vec::new();
        {
            use std::io::Write;
            let mut encoder =
                flate2::write::GzEncoder::new(&mut compressed, flate2::Compression::fast());
            encoder.write_all(SAMPLE.as_bytes()).unwrap();
        }
        let dictionary = Dictionary::read(compressed.as_slice()).unwrap();
        assert!(dictionary.contains("中文"));
    }

    #[test]
    fn reads_the_release_unpacked() {
        let dictionary = Dictionary::read(SAMPLE.as_bytes()).unwrap();
        assert!(dictionary.contains("中文"));
    }
}
