/// CC-CEDICT's numbered pinyin ("Bei3 jing1", "nu:3 er2") with tone marks
/// ("Běi jīng", "nǚ ér"). Tokens without a tone digit pass through unchanged.
pub fn to_tone_marks(numbered: &str) -> String {
    numbered
        .split(' ')
        .map(mark_syllable)
        .collect::<Vec<_>>()
        .join(" ")
}

fn mark_syllable(syllable: &str) -> String {
    let syllable = syllable.replace("u:", "ü").replace("U:", "Ü");
    let Some(last) = syllable.chars().last() else {
        return syllable;
    };
    let Some(tone) = last.to_digit(10).filter(|tone| (1..=5).contains(tone)) else {
        return syllable;
    };
    let mut chars: Vec<char> = syllable.chars().collect();
    chars.pop();
    if tone < 5
        && let Some(index) = tone_vowel_index(&chars)
    {
        chars[index] = with_tone(chars[index], tone);
    }
    chars.into_iter().collect()
}

/// a or e takes the mark, then the o of "ou", otherwise the last vowel.
fn tone_vowel_index(chars: &[char]) -> Option<usize> {
    let lower: Vec<char> = chars
        .iter()
        .map(|c| c.to_lowercase().next().unwrap_or(*c))
        .collect();
    lower
        .iter()
        .position(|&c| c == 'a' || c == 'e')
        .or_else(|| lower.windows(2).position(|pair| pair == ['o', 'u']))
        .or_else(|| lower.iter().rposition(|&c| "iouü".contains(c)))
}

fn with_tone(vowel: char, tone: u32) -> char {
    let marks: [char; 4] = match vowel {
        'a' => ['ā', 'á', 'ǎ', 'à'],
        'e' => ['ē', 'é', 'ě', 'è'],
        'i' => ['ī', 'í', 'ǐ', 'ì'],
        'o' => ['ō', 'ó', 'ǒ', 'ò'],
        'u' => ['ū', 'ú', 'ǔ', 'ù'],
        'ü' => ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
        'A' => ['Ā', 'Á', 'Ǎ', 'À'],
        'E' => ['Ē', 'É', 'Ě', 'È'],
        'I' => ['Ī', 'Í', 'Ǐ', 'Ì'],
        'O' => ['Ō', 'Ó', 'Ǒ', 'Ò'],
        'U' => ['Ū', 'Ú', 'Ǔ', 'Ù'],
        'Ü' => ['Ǖ', 'Ǘ', 'Ǚ', 'Ǜ'],
        _ => return vowel,
    };
    marks[tone as usize - 1]
}

/// CC-CEDICT's numbered pinyin in zhuyin (bopomofo): "xue2 xi2" becomes
/// "ㄒㄩㄝˊ ㄒㄧˊ" and "de5" "˙ㄉㄜ". Tokens that are not syllables pass through.
pub fn to_zhuyin(numbered: &str) -> String {
    numbered
        .split(' ')
        .map(|token| zhuyin_syllable(token).unwrap_or_else(|| token.to_owned()))
        .collect::<Vec<_>>()
        .join(" ")
}

const INITIALS: [(&str, &str); 21] = [
    ("zh", "ㄓ"),
    ("ch", "ㄔ"),
    ("sh", "ㄕ"),
    ("b", "ㄅ"),
    ("p", "ㄆ"),
    ("m", "ㄇ"),
    ("f", "ㄈ"),
    ("d", "ㄉ"),
    ("t", "ㄊ"),
    ("n", "ㄋ"),
    ("l", "ㄌ"),
    ("g", "ㄍ"),
    ("k", "ㄎ"),
    ("h", "ㄏ"),
    ("j", "ㄐ"),
    ("q", "ㄑ"),
    ("x", "ㄒ"),
    ("r", "ㄖ"),
    ("z", "ㄗ"),
    ("c", "ㄘ"),
    ("s", "ㄙ"),
];

fn zhuyin_syllable(token: &str) -> Option<String> {
    let tone = token
        .chars()
        .last()?
        .to_digit(10)
        .filter(|tone| (1..=5).contains(tone))?;
    let syllable = token[..token.len() - 1]
        .to_lowercase()
        .replace("u:", "ü")
        .replace('v', "ü");
    if syllable == "r" {
        return Some(with_zhuyin_tone("ㄦ", tone));
    }
    let (initial, final_) = INITIALS
        .iter()
        .find_map(|(pinyin, zhuyin)| Some((*zhuyin, syllable.strip_prefix(pinyin)?)))
        .unwrap_or(("", syllable.as_str()));
    let final_ = match (initial, final_) {
        // m, n, ng, hm: interjections zhuyin does not spell.
        (_, "") => return None,
        // zhi, chi, shi, ri, zi, ci, si: the initial alone.
        ("ㄓ" | "ㄔ" | "ㄕ" | "ㄖ" | "ㄗ" | "ㄘ" | "ㄙ", "i") => String::new(),
        // After j, q and x, a written u is ü.
        ("ㄐ" | "ㄑ" | "ㄒ", final_) if final_.starts_with('u') => {
            zhuyin_final(&final_.replacen('u', "ü", 1))?
        }
        ("", final_) => zhuyin_final(&spelled_final(final_))?,
        (_, final_) => zhuyin_final(final_)?,
    };
    Some(with_zhuyin_tone(&format!("{initial}{final_}"), tone))
}

/// The first tone is unmarked; the neutral tone's dot goes in front.
fn with_zhuyin_tone(syllable: &str, tone: u32) -> String {
    match ["", "ˊ", "ˇ", "ˋ"].get(tone as usize - 1) {
        Some(mark) => format!("{syllable}{mark}"),
        None => format!("˙{syllable}"),
    }
}

/// A syllable without an initial writes its i, u or ü as y or w: yi, wu, yue.
fn spelled_final(syllable: &str) -> String {
    if let Some(rest) = syllable.strip_prefix('y') {
        return match rest {
            "i" | "in" | "ing" => rest.to_owned(),
            rest if rest.starts_with('u') => rest.replacen('u', "ü", 1),
            "ong" => "iong".to_owned(),
            rest => format!("i{rest}"),
        };
    }
    if let Some(rest) = syllable.strip_prefix('w') {
        return match rest {
            "u" => rest.to_owned(),
            "ei" => "ui".to_owned(),
            "en" => "un".to_owned(),
            rest => format!("u{rest}"),
        };
    }
    syllable.to_owned()
}

fn zhuyin_final(final_: &str) -> Option<String> {
    Some(
        match final_ {
            "a" => "ㄚ",
            "o" => "ㄛ",
            "e" => "ㄜ",
            "ê" => "ㄝ",
            "ai" => "ㄞ",
            "ei" => "ㄟ",
            "ao" => "ㄠ",
            "ou" => "ㄡ",
            "an" => "ㄢ",
            "en" => "ㄣ",
            "ang" => "ㄤ",
            "eng" => "ㄥ",
            "ong" => "ㄨㄥ",
            "er" | "r" => "ㄦ",
            "i" => "ㄧ",
            "ia" => "ㄧㄚ",
            "io" => "ㄧㄛ",
            "ie" => "ㄧㄝ",
            "iai" => "ㄧㄞ",
            "iao" => "ㄧㄠ",
            "iu" | "iou" => "ㄧㄡ",
            "ian" => "ㄧㄢ",
            "in" => "ㄧㄣ",
            "iang" => "ㄧㄤ",
            "ing" => "ㄧㄥ",
            "iong" => "ㄩㄥ",
            "u" => "ㄨ",
            "ua" => "ㄨㄚ",
            "uo" => "ㄨㄛ",
            "uai" => "ㄨㄞ",
            "ui" | "uei" => "ㄨㄟ",
            "uan" => "ㄨㄢ",
            "un" | "uen" => "ㄨㄣ",
            "uang" => "ㄨㄤ",
            "ueng" => "ㄨㄥ",
            "ü" => "ㄩ",
            "üe" => "ㄩㄝ",
            "üan" => "ㄩㄢ",
            "ün" => "ㄩㄣ",
            "" => "",
            _ => return None,
        }
        .to_owned(),
    )
}

#[cfg(test)]
mod tests {
    use super::{to_tone_marks, to_zhuyin};

    #[test]
    fn marks_the_right_vowel() {
        assert_eq!(to_tone_marks("Bei3 jing1"), "Běi jīng");
        assert_eq!(to_tone_marks("xue2 xi2"), "xué xí");
        assert_eq!(to_tone_marks("dou1 gou3"), "dōu gǒu");
        assert_eq!(to_tone_marks("gui4 liu2"), "guì liú");
        assert_eq!(to_tone_marks("nu:3 er2"), "nǚ ér");
        assert_eq!(to_tone_marks("Ou1 zhou1"), "Ōu zhōu");
        assert_eq!(to_tone_marks("E2"), "É");
    }

    #[test]
    fn drops_neutral_tone_and_keeps_non_syllables() {
        assert_eq!(to_tone_marks("de5"), "de");
        assert_eq!(to_tone_marks("r5"), "r");
        assert_eq!(to_tone_marks("A A zhi4"), "A A zhì");
        assert_eq!(to_tone_marks("m2"), "m");
        assert_eq!(to_tone_marks("yi1 , er4"), "yī , èr");
    }

    #[test]
    fn writes_syllables_in_zhuyin() {
        assert_eq!(to_zhuyin("xue2 xi2"), "ㄒㄩㄝˊ ㄒㄧˊ");
        assert_eq!(to_zhuyin("Bei3 jing1"), "ㄅㄟˇ ㄐㄧㄥ");
        assert_eq!(to_zhuyin("zhi1 shi5"), "ㄓ ˙ㄕ");
        assert_eq!(to_zhuyin("ri4 zi5 ci2 si1"), "ㄖˋ ˙ㄗ ㄘˊ ㄙ");
        assert_eq!(to_zhuyin("nu:3 er2"), "ㄋㄩˇ ㄦˊ");
        assert_eq!(to_zhuyin("lu:4 lu4"), "ㄌㄩˋ ㄌㄨˋ");
        assert_eq!(
            to_zhuyin("ju2 qu4 xuan3 jun1"),
            "ㄐㄩˊ ㄑㄩˋ ㄒㄩㄢˇ ㄐㄩㄣ"
        );
        assert_eq!(to_zhuyin("gui4 liu2 dun4"), "ㄍㄨㄟˋ ㄌㄧㄡˊ ㄉㄨㄣˋ");
        assert_eq!(to_zhuyin("xiong2 yong3"), "ㄒㄩㄥˊ ㄩㄥˇ");
    }

    #[test]
    fn writes_y_and_w_spellings_in_zhuyin() {
        assert_eq!(
            to_zhuyin("yi1 ya1 ye4 you3 yan2 yin1 ying1"),
            "ㄧ ㄧㄚ ㄧㄝˋ ㄧㄡˇ ㄧㄢˊ ㄧㄣ ㄧㄥ"
        );
        assert_eq!(to_zhuyin("yu2 yue4 yuan2 yun2"), "ㄩˊ ㄩㄝˋ ㄩㄢˊ ㄩㄣˊ");
        assert_eq!(
            to_zhuyin("wu3 wo3 wei4 wen4 wang2 weng1"),
            "ㄨˇ ㄨㄛˇ ㄨㄟˋ ㄨㄣˋ ㄨㄤˊ ㄨㄥ"
        );
        assert_eq!(to_zhuyin("a1 e4 ai4 er2 r5"), "ㄚ ㄜˋ ㄞˋ ㄦˊ ˙ㄦ");
    }

    #[test]
    fn keeps_tokens_that_are_not_syllables() {
        assert_eq!(to_zhuyin("A A zhi4"), "A A ㄓˋ");
        assert_eq!(to_zhuyin("yi1 , er4"), "ㄧ , ㄦˋ");
        assert_eq!(to_zhuyin("xx5 m2"), "xx5 m2");
    }
}
