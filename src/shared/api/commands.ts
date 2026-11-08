import { Channel, invoke } from "@tauri-apps/api/core";
import type { Script } from "@/shared/config/preferences.ts";

// Mirrors the serde types in src-tauri (camelCase). Keep the two in step.

export interface DocumentSummary {
  id: number;
  title: string;
  fileName: string;
  /** Unix milliseconds. */
  addedAt: number;
  /** Chinese word tokens in the document: the denominator for coverage. */
  totalTokens: number;
  uniqueWords: number;
  knownTokens: number;
  learningTokens: number;
  /** Words neither known nor being learned. */
  unseenWords: number;
  /** Whether `getCover` has an image: an EPUB's cover or a PDF's first page. */
  hasCover: boolean;
  /** The folder it sits in on the shelf; null when loose. */
  folderId: number | null;
  /** Where the reader left off: a section position and a paragraph in it. */
  readingSection: number;
  readingParagraph: number;
}

/** Books grouped on the shelf; Rust drops a folder once it is empty. */
export interface Folder {
  id: number;
  name: string;
}

export interface Reading {
  pinyin: string;
  definitions: string[];
  properNoun: boolean;
}

export interface StudyCard {
  /** The word as stored, in the book's own script: the key for status and review commands. */
  word: string;
  /** `word` in the chosen script. */
  displayWord: string;
  /** Most likely reading first; empty when CC-CEDICT lacks the word. */
  readings: Reading[];
  /** In the chosen script. */
  example: string;
  /** Occurrences in the document; null outside a document. */
  count: number | null;
}

export interface Deck {
  document: DocumentSummary;
  wordsTo95: number;
  wordsTo98: number;
  cards: StudyCard[];
}

/** A run of a section's text: a Chinese word, or the punctuation and other text between words. */
export interface ReaderToken {
  /** In the chosen script. */
  text: string;
  /** The stored word, the key for status commands; null between words. */
  word: string | null;
}

export interface ReaderSection {
  position: number;
  /** In the chosen script; null for an untitled section. */
  title: string | null;
  paragraphs: ReaderToken[][];
  /** The section in reading order, in stretches short enough to speak in one go. */
  phrases: SpokenPhrase[];
}

/** Tokens `start` up to `end` of one paragraph, read aloud together. */
export interface SpokenPhrase {
  paragraph: number;
  start: number;
  end: number;
  /** As the book has it, for `speak`: the audio is the same in either script. */
  text: string;
}

export interface ReviewQueue {
  cards: StudyCard[];
  dueCount: number;
  /** Unix milliseconds of the earliest learning card, due or not. */
  nextDueAt: number | null;
}

export type WordStatus = "known" | "learning";

/** A word's state before a change; pass it back to `restoreWord` to undo. */
export interface WordSnapshot {
  word: string;
  previous: unknown;
}

export interface WordCounts {
  known: number;
  learning: number;
  due: number;
}

export interface ReviewDay {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface DueDay {
  date: string;
  count: number;
}

/** Upper bound of a stability bucket; `longer` is over a year. */
export type StabilityKey = "day" | "week" | "month" | "quarter" | "year" | "longer";

export interface StabilityBucket {
  key: StabilityKey;
  count: number;
}

export interface Statistics {
  counts: WordCounts;
  reviewsPerDay: ReviewDay[];
  /** The next 30 days from today; overdue words count as due today. */
  dueForecast: DueDay[];
  /** Learning words reviewed at least once, by FSRS stability. */
  stability: StabilityBucket[];
  /** Share of the range's reviews not rated "again"; null without reviews. */
  retention: number | null;
  /** Consecutive days with a review, ending today or yesterday. */
  streak: number;
}

export type ImportStage = "reading" | "analyzing" | "saving";

export interface KnownWordsImport {
  found: number;
  added: number;
}

/** FSRS grades: again, hard, good, easy. */
export type Rating = 1 | 2 | 3 | 4;

export const commands = {
  listDocuments: () => invoke<DocumentSummary[]>("list_documents"),

  importDocument: (path: string, onProgress: (stage: ImportStage) => void) => {
    const channel = new Channel<ImportStage>(onProgress);
    return invoke<DocumentSummary>("import_document", { path, onProgress: channel });
  },

  deleteDocument: (id: number) => invoke<null>("delete_document", { id }),

  listFolders: () => invoke<Folder[]>("list_folders"),

  /** Needs a name and at least two books, which leave any folder they were in. */
  createFolder: (name: string, documentIds: number[]) =>
    invoke<Folder>("create_folder", { name, documentIds }),

  renameFolder: (id: number, name: string) => invoke<null>("rename_folder", { id, name }),

  /** A null `folderId` takes the book out of its folder. */
  moveDocument: (documentId: number, folderId: number | null) =>
    invoke<null>("move_document", { documentId, folderId }),

  /** The cover as a `data:` URL; null for a document without `hasCover`. */
  getCover: (documentId: number) => invoke<string | null>("get_cover", { documentId }),

  getDeck: (documentId: number, limit: number, script: Script) =>
    invoke<Deck>("get_deck", { documentId, limit, script }),

  /** Each section's title in reading order, in the chosen script; null when untitled. */
  listSections: (documentId: number, script: Script) =>
    invoke<(string | null)[]>("list_sections", { documentId, script }),

  /** A section split into words exactly as its deck counted them, a paragraph per entry. */
  getSection: (documentId: number, position: number, script: Script) =>
    invoke<ReaderSection>("get_section", { documentId, position, script }),

  setReadingPosition: (documentId: number, section: number, paragraph: number) =>
    invoke<null>("set_reading_position", { documentId, section, paragraph }),

  /** The status of each known or learning word among `words`; unseen words are absent. */
  getWordStatuses: (words: string[]) =>
    invoke<Partial<Record<string, WordStatus>>>("get_word_statuses", { words }),

  /** A word on its own, with an example sentence from any book that has it; `count` is null. */
  getWordCard: (word: string, script: Script) =>
    invoke<StudyCard>("get_word_card", { word, script }),

  /** Resolves to how many of `words` were not known before. */
  markWordsKnown: (words: string[]) => invoke<number>("mark_words_known", { words }),

  setWordStatus: (word: string, status: WordStatus) =>
    invoke<WordSnapshot>("set_word_status", { word, status }),

  restoreWord: (snapshot: WordSnapshot) => invoke<null>("restore_word", { snapshot }),

  getReviewQueue: (limit: number, script: Script) =>
    invoke<ReviewQueue>("get_review_queue", { limit, script }),

  reviewWord: (word: string, rating: Rating) => invoke<null>("review_word", { word, rating }),

  importKnownWords: (text: string) => invoke<KnownWordsImport>("import_known_words", { text }),

  getWordCounts: () => invoke<WordCounts>("get_word_counts"),

  getStatistics: (days: number) => invoke<Statistics>("get_statistics", { days }),

  /** A word or phrase spoken aloud, as an Ogg Opus file; Rust saves it, so each is generated once. */
  speak: (text: string) => invoke<ArrayBuffer>("speak", { text }),
};

export type CommandName =
  | "list_documents"
  | "import_document"
  | "delete_document"
  | "list_folders"
  | "create_folder"
  | "rename_folder"
  | "move_document"
  | "get_cover"
  | "get_deck"
  | "list_sections"
  | "get_section"
  | "set_reading_position"
  | "get_word_statuses"
  | "get_word_card"
  | "mark_words_known"
  | "set_word_status"
  | "restore_word"
  | "get_review_queue"
  | "review_word"
  | "import_known_words"
  | "get_word_counts"
  | "get_statistics"
  | "speak";

/** Rust rejects with its error's message as a plain string. */
export function commandErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
