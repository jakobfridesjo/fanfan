import type {
  Deck,
  DocumentSummary,
  ReaderSection,
  ReaderToken,
  ReviewCard,
  ReviewQueue,
  ReviewSnapshot,
  Statistics,
  StudyCard,
  WordCounts,
  WordEntry,
} from "@/shared/api/commands.ts";

// Builders for command results; override only the fields a test reads.

export function makeDocument(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: 1,
    title: "春天的故事",
    fileName: "spring.epub",
    addedAt: Date.UTC(2026, 0, 1),
    totalTokens: 1000,
    uniqueWords: 200,
    knownTokens: 600,
    learningTokens: 100,
    unseenWords: 150,
    hasCover: false,
    folderId: null,
    readingSection: 0,
    readingParagraph: 0,
    ...overrides,
  };
}

export function makeCard(word: string, overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    word,
    displayWord: word,
    readings: [
      { pinyin: `${word}-pinyin`, definitions: [`meaning of ${word}`], properNoun: false },
    ],
    example: `我们在这里${word}。`,
    count: 10,
    hskLevel: null,
    tocflLevel: null,
    ...overrides,
  };
}

export function makeDeck(cards: StudyCard[], overrides: Partial<Deck> = {}): Deck {
  return { document: makeDocument(), wordsTo95: 40, wordsTo98: 120, cards, ...overrides };
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Cards without their own `intervals` get 10 minutes, 1, 3 and 8 days. */
export function makeReviewQueue(
  cards: (StudyCard | ReviewCard)[],
  overrides: Partial<ReviewQueue> = {}
): ReviewQueue {
  return {
    cards: cards.map((card) => ({
      intervals: [10 * MINUTE, DAY, 3 * DAY, 8 * DAY],
      ...card,
    })),
    dueCount: cards.length,
    nextDueAt: null,
    ...overrides,
  };
}

export function makeReviewSnapshot(word: string, reviewId = 1): ReviewSnapshot {
  return { word: { word, previous: null }, reviewId };
}

export function makeWordEntry(word: string, overrides: Partial<WordEntry> = {}): WordEntry {
  return {
    word,
    displayWord: word,
    readings: [
      { pinyin: `${word}-pinyin`, definitions: [`meaning of ${word}`], properNoun: false },
    ],
    status: "known",
    dueAt: null,
    updatedAt: Date.UTC(2026, 0, 1),
    hskLevel: null,
    tocflLevel: null,
    ...overrides,
  };
}

export function makeWordCounts(overrides: Partial<WordCounts> = {}): WordCounts {
  return { known: 0, learning: 0, due: 0, ...overrides };
}

export function makeStatistics(overrides: Partial<Statistics> = {}): Statistics {
  return {
    counts: makeWordCounts(),
    reviewsPerDay: [],
    dueForecast: [],
    stability: [],
    retention: null,
    streak: 0,
    ...overrides,
  };
}

/** Paragraphs from text with words split at spaces, e.g. `"我们 学习 。"`; Chinese runs are words. */
export function makeSection(
  paragraphs: string[],
  overrides: Partial<ReaderSection> = {}
): ReaderSection {
  const token = (text: string): ReaderToken => ({
    text,
    word: /\p{Script=Han}/u.test(text) ? text : null,
  });
  const tokens = paragraphs.map((paragraph) => paragraph.split(" ").map(token));
  return {
    position: 0,
    title: null,
    paragraphs: tokens,
    phrases: tokens.map((paragraphTokens, paragraph) => ({
      paragraph,
      start: 0,
      end: paragraphTokens.length,
      text: paragraphTokens.map((piece) => piece.word ?? piece.text).join(""),
    })),
    ...overrides,
  };
}

/** A tenth of a second of silence as 64 kbit/s Ogg Opus, the format Rust sends. */
export function silentOpus() {
  return Uint8Array.from(
    atob(
      "T2dnUwACAAAAAAAAAABab4JrAAAAAJYQG9kBE09wdXNIZWFkAQE4AYC7AAAAAABPZ2dTAAAAAAAAAAAAAFpvgmsBAAAAo9wjHQFNT3B1c1RhZ3MeAAAARW5jb2RlZCB3aXRoIEdTdHJlYW1lciBvcHVzZW5jAQAAABoAAABERVNDUklQVElPTj1hdWRpb3Rlc3Qgd2F2ZQFPZ2dTAAT4EwAAAAAAAFpvgmsCAAAAxztY1AYDAwMDAwP4//74//74//74//74//74//4="
    ),
    (char) => char.charCodeAt(0)
  ).buffer;
}
