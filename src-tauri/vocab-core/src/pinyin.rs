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

#[cfg(test)]
mod tests {
    use super::to_tone_marks;

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
}
