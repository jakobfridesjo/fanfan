import { createAtom, type Atom } from "@tanstack/react-store";
import * as z from "zod/mini";
import { persistedJson, persistedString } from "@/shared/lib/persisted-value.ts";

export const THEMES = ["light", "dark", "auto"] as const;
export const LANGUAGES = ["en", "sv", "zh"] as const;
export const SCRIPTS = ["simplified", "traditional", "both"] as const;
export const BACKGROUNDS = [
  "fireflies",
  "sea",
  "cherry",
  "mist",
  "sunset",
  "ink",
  "pyreflies",
  "plain",
] as const;
export const EXAMS = ["hsk", "tbcl"] as const;
export const NOTATIONS = ["pinyin", "zhuyin", "cangjie"] as const;
export const READER_NOTATIONS = ["off", "pinyin", "zhuyin"] as const;
export const SPEAKERS = ["lingyu", "weiguo", "junhao", "zhiming", "xiaoyu", "yuewen"] as const;

/** `auto` follows the system's light or dark setting. */
export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];
/** The characters Chinese words are shown in; Rust converts them. `both` is simplified with traditional beside it. */
export type Script = (typeof SCRIPTS)[number];
export type Background = (typeof BACKGROUNDS)[number];
/** Exams whose level each word card shows. */
export type Exam = (typeof EXAMS)[number];
/** What words are shown with besides their meanings: pinyin and zhuyin readings, Cangjie codes. */
export type Notation = (typeof NOTATIONS)[number];
/** The reading the reader writes small above each character. */
export type ReaderNotation = (typeof READER_NOTATIONS)[number];
/** The voice that reads aloud; Rust keeps each one's audio apart. */
export type Speaker = (typeof SPEAKERS)[number];

/** A preference kept in `localStorage`, readable outside React (query keys, formatters). */
function persistedAtom<T extends string>(key: string, values: readonly [T, ...T[]], fallback: T) {
  const stored = persistedString<T>({ key, schema: z.enum(values), fallback });
  const atom = createAtom(stored.load());
  atom.subscribe((value) => stored.save(value));
  return Object.assign(atom, { reset: () => atom.set(fallback) }) satisfies Atom<T>;
}

export const themeAtom = persistedAtom<Theme>("themePreference", THEMES, "auto");
export const languageAtom = persistedAtom<Language>("language", LANGUAGES, "en");
export const scriptAtom = persistedAtom<Script>("script", SCRIPTS, "simplified");
export const backgroundAtom = persistedAtom<Background>("background", BACKGROUNDS, "fireflies");
export const speakerAtom = persistedAtom<Speaker>("speaker", SPEAKERS, "lingyu");
export const readerNotationAtom = persistedAtom<ReaderNotation>(
  "readerNotation",
  READER_NOTATIONS,
  "off"
);

/** A list preference kept in `localStorage`; any combination of `values`, none included. */
function persistedListAtom<T extends string>(
  key: string,
  values: readonly [T, ...T[]],
  fallback: T[]
) {
  const stored = persistedJson<T[]>({ key, schema: z.array(z.enum(values)), fallback });
  const atom = createAtom(stored.load());
  atom.subscribe((value) => stored.save(value));
  return Object.assign(atom, { reset: () => atom.set([...fallback]) }) satisfies Atom<T[]>;
}

export const shownExamsAtom = persistedListAtom<Exam>("shownExams", EXAMS, [...EXAMS]);
export const shownNotationsAtom = persistedListAtom<Notation>("shownNotations", NOTATIONS, [
  "pinyin",
]);

/** Back to the defaults, for tests that share one page. */
export function resetPreferences() {
  themeAtom.reset();
  languageAtom.reset();
  scriptAtom.reset();
  backgroundAtom.reset();
  speakerAtom.reset();
  readerNotationAtom.reset();
  shownNotationsAtom.reset();
  shownExamsAtom.reset();
}
