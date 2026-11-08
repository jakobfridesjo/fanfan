use std::collections::BTreeMap;
use std::ops::ControlFlow;

use chrono::{DateTime, Days, Duration, NaiveDate, TimeZone};
use rs_fsrs::State;
use serde::Serialize;

use crate::error::Result;
use crate::store::{Store, WordCounts};

pub const FORECAST_DAYS: u32 = 30;

/// Upper bounds in days of each stability bucket; the last bucket is open-ended.
const STABILITY_BOUNDS: [(&str, f64); 5] = [
    ("day", 1.0),
    ("week", 7.0),
    ("month", 30.0),
    ("quarter", 90.0),
    ("year", 365.0),
];
const STABILITY_OVER_A_YEAR: &str = "longer";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Statistics {
    pub counts: WordCounts,
    pub reviews_per_day: Vec<ReviewDay>,
    pub due_forecast: Vec<DueDay>,
    pub stability: Vec<StabilityBucket>,
    /// Share of the range's reviews not rated "again"; `None` without reviews.
    pub retention: Option<f64>,
    /// Consecutive days with a review, ending today or, before today's first review, yesterday.
    pub streak: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewDay {
    pub date: String,
    pub again: u32,
    pub hard: u32,
    pub good: u32,
    pub easy: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DueDay {
    pub date: String,
    pub count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StabilityBucket {
    pub key: &'static str,
    pub count: u32,
}

/// Study statistics over the `days` days ending today, bucketed by `now`'s calendar days.
pub fn statistics<Tz: TimeZone>(store: &Store, now: DateTime<Tz>, days: u32) -> Result<Statistics> {
    let zone = now.timezone();
    let local_date = |millis: i64| zone.timestamp_millis_opt(millis).unwrap().date_naive();
    let today = now.date_naive();
    let first_day = today - Days::new(u64::from(days.max(1) - 1));

    // A day earlier than `first_day` begins, whatever the time zone does; `per_day` drops the extra.
    let from = now.to_utc() - Duration::days(i64::from(days.max(1)) + 1);
    let reviews = store.reviews_since(from.timestamp_millis())?;
    let mut per_day: BTreeMap<NaiveDate, ReviewDay> = dates(first_day, days.max(1))
        .map(|date| (date, review_day(date)))
        .collect();
    for &(reviewed_at, rating) in &reviews {
        if let Some(day) = per_day.get_mut(&local_date(reviewed_at)) {
            match rating {
                1 => day.again += 1,
                2 => day.hard += 1,
                3 => day.good += 1,
                _ => day.easy += 1,
            }
        }
    }
    let reviewed: u32 = per_day
        .values()
        .map(|day| day.again + day.hard + day.good + day.easy)
        .sum();
    let forgotten: u32 = per_day.values().map(|day| day.again).sum();
    let retention = (reviewed > 0).then(|| f64::from(reviewed - forgotten) / f64::from(reviewed));

    let mut streak = Streak::new(today);
    store.visit_review_times_newest_first(|at| streak.add(local_date(at)))?;
    let cards = store.learning_cards()?;

    let mut forecast: BTreeMap<NaiveDate, u32> =
        dates(today, FORECAST_DAYS).map(|date| (date, 0)).collect();
    for card in &cards {
        let due = local_date(card.due.timestamp_millis()).max(today);
        if let Some(count) = forecast.get_mut(&due) {
            *count += 1;
        }
    }

    Ok(Statistics {
        counts: store.counts(now.to_utc())?,
        reviews_per_day: per_day.into_values().collect(),
        due_forecast: forecast
            .into_iter()
            .map(|(date, count)| DueDay {
                date: wire_date(date),
                count,
            })
            .collect(),
        stability: stability_buckets(
            cards
                .iter()
                .filter(|card| card.state != State::New)
                .map(|card| card.stability),
        ),
        retention,
        streak: streak.days,
    })
}

fn dates(first: NaiveDate, count: u32) -> impl Iterator<Item = NaiveDate> {
    first.iter_days().take(count as usize)
}

fn wire_date(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

fn review_day(date: NaiveDate) -> ReviewDay {
    ReviewDay {
        date: wire_date(date),
        again: 0,
        hard: 0,
        good: 0,
        easy: 0,
    }
}

fn stability_buckets(stabilities: impl Iterator<Item = f64>) -> Vec<StabilityBucket> {
    let mut buckets: Vec<StabilityBucket> = STABILITY_BOUNDS
        .iter()
        .map(|&(key, _)| key)
        .chain([STABILITY_OVER_A_YEAR])
        .map(|key| StabilityBucket { key, count: 0 })
        .collect();
    for stability in stabilities {
        let index = STABILITY_BOUNDS
            .iter()
            .position(|&(_, bound)| stability < bound)
            .unwrap_or(STABILITY_BOUNDS.len());
        buckets[index].count += 1;
    }
    buckets
}

/// Consecutive days with a review, ending today or, before today's first review, yesterday.
struct Streak {
    today: NaiveDate,
    /// The day that continues the streak.
    next: NaiveDate,
    days: u32,
}

impl Streak {
    fn new(today: NaiveDate) -> Self {
        Self {
            today,
            next: today,
            days: 0,
        }
    }

    /// Takes the days of reviews newest first, and breaks at the first gap.
    fn add(&mut self, date: NaiveDate) -> ControlFlow<()> {
        let yesterday = self.today - Days::new(1);
        if date > self.next {
            // A day already counted, or a review dated after today.
            return ControlFlow::Continue(());
        }
        if date != self.next && !(self.days == 0 && date == yesterday) {
            return ControlFlow::Break(());
        }
        self.days += 1;
        self.next = date - Days::new(1);
        ControlFlow::Continue(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::WordStatus;
    use chrono::{Duration, FixedOffset, Utc};

    /// 23:30 on 10 January in UTC+2, which is still 21:30 in UTC.
    fn now() -> DateTime<FixedOffset> {
        FixedOffset::east_opt(2 * 3600)
            .unwrap()
            .with_ymd_and_hms(2026, 1, 10, 23, 30, 0)
            .unwrap()
    }

    fn learning(store: &mut Store, word: &str, at: DateTime<FixedOffset>) {
        store
            .set_status(word, WordStatus::Learning, at.to_utc())
            .unwrap();
    }

    #[test]
    fn counts_each_local_day_by_rating_and_fills_days_without_reviews() {
        let mut store = Store::open_in_memory().unwrap();
        learning(&mut store, "中文", now() - Duration::days(10));
        store
            .review("中文", 3, (now() - Duration::days(9)).to_utc())
            .unwrap();
        store
            .review("中文", 4, (now() - Duration::days(2)).to_utc())
            .unwrap();
        // 00:10 local on the 10th is still the 9th in UTC.
        store
            .review(
                "中文",
                1,
                (now() - Duration::minutes(23 * 60 + 20)).to_utc(),
            )
            .unwrap();
        store.review("中文", 3, now().to_utc()).unwrap();

        let statistics = statistics(&store, now(), 3).unwrap();

        assert_eq!(
            statistics.reviews_per_day,
            [
                ReviewDay {
                    date: "2026-01-08".into(),
                    again: 0,
                    hard: 0,
                    good: 0,
                    easy: 1
                },
                ReviewDay {
                    date: "2026-01-09".into(),
                    again: 0,
                    hard: 0,
                    good: 0,
                    easy: 0
                },
                ReviewDay {
                    date: "2026-01-10".into(),
                    again: 1,
                    hard: 0,
                    good: 1,
                    easy: 0
                },
            ]
        );
        assert_eq!(statistics.retention, Some(2.0 / 3.0));
        assert_eq!(statistics.streak, 1);
    }

    #[test]
    fn has_no_retention_without_reviews_in_range() {
        let store = Store::open_in_memory().unwrap();
        let statistics = statistics(&store, now(), 7).unwrap();
        assert_eq!(statistics.reviews_per_day.len(), 7);
        assert_eq!(statistics.retention, None);
        assert_eq!(statistics.streak, 0);
    }

    #[test]
    fn a_streak_survives_until_today_has_its_first_review() {
        let mut store = Store::open_in_memory().unwrap();
        learning(&mut store, "中文", now() - Duration::days(6));
        for days_ago in [5, 3, 2, 1] {
            store
                .review("中文", 3, (now() - Duration::days(days_ago)).to_utc())
                .unwrap();
        }
        assert_eq!(statistics(&store, now(), 7).unwrap().streak, 3);
    }

    #[test]
    fn forecasts_overdue_words_as_due_today() {
        let mut store = Store::open_in_memory().unwrap();
        learning(&mut store, "老", now() - Duration::days(4));
        learning(&mut store, "今", now());
        learning(&mut store, "远", now());
        let due_far = store.review("远", 4, now().to_utc()).unwrap();

        let statistics = statistics(&store, now(), 7).unwrap();

        assert_eq!(statistics.due_forecast.len(), FORECAST_DAYS as usize);
        assert_eq!(
            statistics.due_forecast[0],
            DueDay {
                date: "2026-01-10".into(),
                count: 2
            }
        );
        let due_far = Utc
            .timestamp_millis_opt(due_far)
            .unwrap()
            .with_timezone(&now().timezone());
        let far_day = statistics
            .due_forecast
            .iter()
            .find(|day| day.date == wire_date(due_far.date_naive()))
            .unwrap();
        assert_eq!(far_day.count, 1);
    }

    #[test]
    fn buckets_stability_by_upper_bound_and_skips_unreviewed_cards() {
        assert_eq!(
            stability_buckets([0.5, 1.0, 6.9, 7.0, 400.0].into_iter())
                .iter()
                .map(|bucket| (bucket.key, bucket.count))
                .collect::<Vec<_>>(),
            [
                ("day", 1),
                ("week", 2),
                ("month", 1),
                ("quarter", 0),
                ("year", 0),
                ("longer", 1)
            ]
        );

        let mut store = Store::open_in_memory().unwrap();
        learning(&mut store, "新", now());
        let total: u32 = statistics(&store, now(), 7)
            .unwrap()
            .stability
            .iter()
            .map(|b| b.count)
            .sum();
        assert_eq!(total, 0);
    }
}
