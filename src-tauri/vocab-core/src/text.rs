use chardetng::{EncodingDetector, Iso2022JpDetection, Utf8Detection};
use encoding_rs::Encoding;
use unicode_normalization::UnicodeNormalization;

/// Decodes a text file of unknown encoding: a BOM wins, then valid UTF-8, then
/// chardetng's guess (GBK/GB18030 and Big5 are the usual suspects for Chinese).
pub fn decode(bytes: &[u8]) -> String {
    if let Some((encoding, bom_length)) = Encoding::for_bom(bytes) {
        return encoding
            .decode_without_bom_handling(&bytes[bom_length..])
            .0
            .into_owned();
    }
    if let Ok(text) = std::str::from_utf8(bytes) {
        return text.to_owned();
    }
    let mut detector = EncodingDetector::new(Iso2022JpDetection::Deny);
    detector.feed(bytes, true);
    let encoding = detector.guess(None, Utf8Detection::Deny);
    encoding.decode_without_bom_handling(bytes).0.into_owned()
}

/// PDF fonts often map characters to look-alike radicals (U+2F00 ⼀ for 一) or
/// compatibility ideographs; folding them back makes the text match the dictionary.
pub fn normalize(text: &str) -> String {
    text.chars()
        .flat_map(|c| {
            let fold = matches!(c, '\u{2E80}'..='\u{2FDF}' | '\u{F900}'..='\u{FAFF}');
            let folded: Vec<char> = if fold {
                std::iter::once(c).nfkc().collect()
            } else {
                vec![c]
            };
            folded
        })
        .collect()
}

pub fn is_han(c: char) -> bool {
    matches!(c,
        '\u{3400}'..='\u{4DBF}'
        | '\u{4E00}'..='\u{9FFF}'
        | '\u{F900}'..='\u{FAFF}'
        | '\u{20000}'..='\u{3134F}')
}

pub fn contains_han(text: &str) -> bool {
    text.chars().any(is_han)
}

/// Words from a pasted or exported list (Pleco, Anki, one per line, ...): the
/// first tab- or comma-separated column of each line, split on whitespace and
/// Chinese list punctuation, keeping only all-Han tokens.
pub fn parse_word_list(text: &str) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    text.lines()
        .filter_map(|line| line.split(['\t', ',']).next())
        .flat_map(|column| column.split(|c: char| c.is_whitespace() || "、，；;|/".contains(c)))
        .map(str::trim)
        .filter(|token| !token.is_empty() && token.chars().all(is_han))
        .filter(|token| seen.insert(token.to_string()))
        .map(str::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_utf8_gbk_big5_and_bom() {
        let text = "我们在北京学习中文，觉得汉语很有意思。";
        assert_eq!(decode(text.as_bytes()), text);

        let (gbk, _, _) = encoding_rs::GBK.encode(text);
        assert_eq!(decode(&gbk), text);

        let traditional = "我們在台北學習中文，覺得漢語很有意思。";
        let (big5, _, _) = encoding_rs::BIG5.encode(traditional);
        assert_eq!(decode(&big5), traditional);

        let mut with_bom = vec![0xEF, 0xBB, 0xBF];
        with_bom.extend_from_slice(text.as_bytes());
        assert_eq!(decode(&with_bom), text);
    }

    #[test]
    fn folds_radicals_but_keeps_punctuation() {
        assert_eq!(normalize("第⼀章，⼤学！"), "第一章，大学！");
    }

    #[test]
    fn parses_word_lists_from_common_exports() {
        let text = "你好\tnǐhǎo\thello\n学习, xuéxí\n北京 上海、广州\nhello\n你好\n";
        assert_eq!(
            parse_word_list(text),
            vec!["你好", "学习", "北京", "上海", "广州"]
        );
    }
}
