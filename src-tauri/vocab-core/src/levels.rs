use std::collections::HashMap;
use std::sync::LazyLock;

/// `word\thsk\ttbcl`, empty or missing where a list lacks the word, in simplified and
/// traditional forms; rebuilt by `mise data:update`.
const LEVELS: &str = include_str!("../data/levels.tsv");

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct WordLevels {
    /// HSK 3.0, 1 to 7, where 7 stands for levels 7-9.
    pub hsk: Option<u8>,
    /// Taiwan's TBCL (臺灣華語文能力基準), 1 to 7.
    pub tbcl: Option<u8>,
}

static TABLE: LazyLock<HashMap<&'static str, WordLevels>> = LazyLock::new(|| {
    LEVELS
        .lines()
        .skip(1)
        .filter_map(|line| {
            let mut columns = line.split('\t');
            let word = columns.next()?;
            let hsk = columns.next().and_then(|level| level.parse().ok());
            let tbcl = columns.next().and_then(|level| level.parse().ok());
            Some((word, WordLevels { hsk, tbcl }))
        })
        .collect()
});

/// The word's exam levels, found whichever script it is written in.
pub fn levels_of(word: &str) -> WordLevels {
    TABLE.get(word).copied().unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_levels_in_either_script() {
        let expected = WordLevels {
            hsk: Some(1),
            tbcl: Some(2),
        };
        assert_eq!(levels_of("学习"), expected);
        assert_eq!(levels_of("學習"), expected);
    }

    #[test]
    fn leaves_unlisted_words_and_tests_empty() {
        assert_eq!(levels_of("阿拉伯语").tbcl, None);
        assert_eq!(levels_of("阿拉伯语").hsk, Some(7));
        assert_eq!(levels_of("北京大学生"), WordLevels::default());
    }

    #[test]
    fn reads_every_row() {
        let rows = LEVELS.lines().count() - 1;
        assert_eq!(TABLE.len(), rows);
        assert!(
            TABLE
                .values()
                .all(|levels| *levels != WordLevels::default())
        );
    }
}
