use std::collections::HashMap;
use std::sync::LazyLock;

/// `character\tcangjie` from Unihan's kCangjie; rebuilt by `mise data:update`.
const CODES: &str = include_str!("../data/cangjie.tsv");

static TABLE: LazyLock<HashMap<char, &'static str>> = LazyLock::new(|| {
    CODES
        .lines()
        .skip(1)
        .filter_map(|line| {
            let (character, code) = line.split_once('\t')?;
            Some((character.chars().next()?, code))
        })
        .collect()
});

/// Each character's Cangjie code, space-separated; `None` when any character lacks one.
pub fn cangjie_of(word: &str) -> Option<String> {
    let codes = word
        .chars()
        .map(|character| TABLE.get(&character).copied())
        .collect::<Option<Vec<_>>>()?;
    (!codes.is_empty()).then(|| codes.join(" "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_each_character_in_either_script() {
        assert_eq!(cangjie_of("學習").as_deref(), Some("HBND SMHA"));
        assert_eq!(cangjie_of("学习").as_deref(), Some("FBND SIM"));
    }

    #[test]
    fn has_no_code_for_a_word_with_an_uncoded_character() {
        assert_eq!(cangjie_of("學A"), None);
        assert_eq!(cangjie_of(""), None);
    }
}
