use std::collections::HashMap;

use jieba_rs::Jieba;

use crate::dictionary::Dictionary;
use crate::text::{contains_han, normalize};

const EXAMPLE_MAX_CHARS: usize = 60;

#[derive(Debug, Clone, PartialEq)]
pub struct WordStat {
    pub word: String,
    pub count: u32,
    /// The first sentence the word appears in, trimmed around it.
    pub example: String,
}

#[derive(Debug, Default)]
pub struct Analysis {
    /// Chinese word tokens in the text; the denominator for coverage.
    pub total_tokens: u32,
    /// Most frequent first, ties in reading order.
    pub words: Vec<WordStat>,
}

/// A run of text: a Chinese word, or the punctuation, Latin or space between words.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Piece<'a> {
    pub text: &'a str,
    pub is_word: bool,
}

/// Segments with jieba, then re-splits any token CC-CEDICT does not know
/// (names, HMM guesses) into dictionary words, so every card has a definition.
/// The pieces join back into `text`. Decks and the reader both split text
/// here, so the words a reader shows are the words a deck counts.
pub fn tokenize<'a>(text: &'a str, jieba: &Jieba, dictionary: &Dictionary) -> Vec<Piece<'a>> {
    let mut pieces = Vec::new();
    for token in jieba.cut(text, true) {
        let token = token.word;
        if !contains_han(token) {
            pieces.push(Piece {
                text: token,
                is_word: false,
            });
            continue;
        }
        let words = if dictionary.contains(token) {
            vec![token]
        } else {
            dictionary.split_into_words(token)
        };
        pieces.extend(words.into_iter().map(|word| Piece {
            text: word,
            is_word: contains_han(word),
        }));
    }
    pieces
}

pub fn analyze(text: &str, jieba: &Jieba, dictionary: &Dictionary) -> Analysis {
    let text = normalize(text);
    let mut stats: HashMap<&str, (u32, usize, String)> = HashMap::new();
    let mut total_tokens = 0;

    for sentence in sentences(&text) {
        let words = tokenize(sentence, jieba, dictionary)
            .into_iter()
            .filter(|piece| piece.is_word);
        for Piece { text: word, .. } in words {
            total_tokens += 1;
            let order = stats.len();
            stats
                .entry(word)
                .or_insert_with(|| (0, order, example_around(sentence, word)))
                .0 += 1;
        }
    }

    let mut words: Vec<(u32, usize, WordStat)> = stats
        .into_iter()
        .map(|(word, (count, order, example))| {
            let stat = WordStat {
                word: word.to_owned(),
                count,
                example,
            };
            (count, order, stat)
        })
        .collect();
    words.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));

    Analysis {
        total_tokens,
        words: words.into_iter().map(|(_, _, stat)| stat).collect(),
    }
}

/// Splits after sentence-final punctuation (keeping closing quotes with their
/// sentence) and at line breaks.
fn sentences(text: &str) -> impl Iterator<Item = &str> {
    let mut sentences = Vec::new();
    let mut start = 0;
    let mut chars = text.char_indices().peekable();
    while let Some((index, c)) = chars.next() {
        let ends = "。！？!?；;…\n".contains(c);
        if !ends {
            continue;
        }
        let mut end = index + c.len_utf8();
        while let Some(&(next_index, next)) = chars.peek() {
            if !"。！？!?…”’」』）)\"".contains(next) {
                break;
            }
            end = next_index + next.len_utf8();
            chars.next();
        }
        sentences.push(&text[start..end]);
        start = end;
    }
    sentences.push(&text[start..]);
    sentences
        .into_iter()
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

fn example_around(sentence: &str, word: &str) -> String {
    let chars: Vec<char> = sentence.chars().collect();
    if chars.len() <= EXAMPLE_MAX_CHARS {
        return sentence.to_owned();
    }
    let word_start = sentence
        .find(word)
        .map_or(0, |byte| sentence[..byte].chars().count());
    let start = word_start
        .saturating_sub(EXAMPLE_MAX_CHARS / 3)
        .min(chars.len() - EXAMPLE_MAX_CHARS);
    let end = start + EXAMPLE_MAX_CHARS;
    let mut example: String = chars[start..end].iter().collect();
    if start > 0 {
        example.insert(0, '…');
    }
    if end < chars.len() {
        example.push('…');
    }
    example
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dictionary::tests::SAMPLE;

    fn analyze_sample(text: &str) -> Analysis {
        analyze(text, &Jieba::new(), &Dictionary::parse(SAMPLE))
    }

    fn words(analysis: &Analysis) -> Vec<(&str, u32)> {
        analysis
            .words
            .iter()
            .map(|stat| (stat.word.as_str(), stat.count))
            .collect()
    }

    #[test]
    fn counts_chinese_words_by_frequency_then_reading_order() {
        let analysis = analyze_sample("我们在北京大学学习中文。他很好，我们很好！");
        assert_eq!(
            words(&analysis),
            [
                ("我们", 2),
                ("很", 2),
                ("好", 2),
                ("在", 1),
                ("北京大学", 1),
                ("学习", 1),
                ("中文", 1),
                ("他", 1),
            ]
        );
        assert_eq!(analysis.total_tokens, 11);
    }

    #[test]
    fn ignores_punctuation_latin_and_digits() {
        let analysis = analyze_sample("Hello 2024，“中文”! abc");
        assert_eq!(words(&analysis), [("中文", 1)]);
        assert_eq!(analysis.total_tokens, 1);
    }

    #[test]
    fn splits_tokens_the_dictionary_lacks() {
        // jieba keeps 不难 as one token; CC-CEDICT only knows 不 and 难.
        let analysis = analyze_sample("中文不难。");
        assert_eq!(words(&analysis), [("中文", 1), ("不", 1), ("难", 1)]);
    }

    #[test]
    fn keeps_the_first_sentence_as_the_example() {
        let analysis = analyze_sample("他说：“中文很好。”我们在北京学习中文。");
        let example = |word: &str| {
            analysis
                .words
                .iter()
                .find(|stat| stat.word == word)
                .map(|stat| stat.example.clone())
        };
        assert_eq!(example("中文").as_deref(), Some("他说：“中文很好。”"));
        assert_eq!(example("学习").as_deref(), Some("我们在北京学习中文。"));
    }

    #[test]
    fn trims_long_examples_around_the_word() {
        let long = format!("{}学习{}。", "很".repeat(80), "好".repeat(80));
        let analysis = analyze_sample(&long);
        let example = &analysis
            .words
            .iter()
            .find(|stat| stat.word == "学习")
            .unwrap()
            .example;
        assert!(example.starts_with('…') && example.ends_with('…'));
        assert!(example.contains("学习"));
        assert_eq!(example.chars().count(), EXAMPLE_MAX_CHARS + 2);
    }

    #[test]
    fn tokenizes_into_pieces_that_join_back_into_the_text() {
        let text = "他说：“中文不难！”  Hello 2024，我们在北京大学学习中文。";
        let pieces = tokenize(text, &Jieba::new(), &Dictionary::parse(SAMPLE));
        assert_eq!(
            pieces.iter().map(|piece| piece.text).collect::<String>(),
            text
        );
        let words: Vec<&str> = pieces
            .iter()
            .filter(|piece| piece.is_word)
            .map(|piece| piece.text)
            .collect();
        assert_eq!(
            words,
            [
                "他",
                "说",
                "中文",
                "不",
                "难",
                "我们",
                "在",
                "北京大学",
                "学习",
                "中文"
            ]
        );
    }

    #[test]
    fn counts_the_words_a_whole_paragraph_tokenizes_into() {
        let paragraph = "他说：“中文很好。”我们在北京学习中文！你们呢？";
        let (jieba, dictionary) = (Jieba::new(), Dictionary::parse(SAMPLE));
        let mut counts: HashMap<&str, u32> = HashMap::new();
        for piece in tokenize(paragraph, &jieba, &dictionary) {
            if piece.is_word {
                *counts.entry(piece.text).or_default() += 1;
            }
        }
        let analysis = analyze(paragraph, &jieba, &dictionary);
        let analyzed: HashMap<&str, u32> = words(&analysis).into_iter().collect();
        assert_eq!(counts, analyzed);
    }

    #[test]
    fn folds_pdf_radicals_before_counting() {
        let analysis = analyze_sample("我们在北京⼤学学习中⽂。");
        assert!(words(&analysis).contains(&("中文", 1)));
    }
}
