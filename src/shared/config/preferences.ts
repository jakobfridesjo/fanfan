import { createAtom, type Atom } from "@tanstack/react-store";
import * as z from "zod/mini";
import { persistedJson, persistedString } from "@/shared/lib/persisted-value.ts";

export const THEMES = ["light", "dark", "auto"] as const;
export const LANGUAGES = ["en", "sv", "zh"] as const;
export const SCRIPTS = ["simplified", "traditional"] as const;
export const BACKGROUNDS = [
  "fireflies",
  "sea",
  "cherry",
  "mist",
  "sunset",
  "pyreflies",
  "plain",
] as const;
export const EXAMS = ["hsk", "tocfl"] as const;

/** `auto` follows the system's light or dark setting. */
export type Theme = (typeof THEMES)[number];
export type Language = (typeof LANGUAGES)[number];
/** The characters Chinese words are shown in; Rust converts them. */
export type Script = (typeof SCRIPTS)[number];
export type Background = (typeof BACKGROUNDS)[number];
/** Exams whose level each word card shows. */
export type Exam = (typeof EXAMS)[number];

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

const shownExams = persistedJson<Exam[]>({
  key: "shownExams",
  schema: z.array(z.enum(EXAMS)),
  fallback: [...EXAMS],
});
const examsAtom = createAtom(shownExams.load());
examsAtom.subscribe((exams) => shownExams.save(exams));
export const shownExamsAtom = Object.assign(examsAtom, {
  reset: () => examsAtom.set([...EXAMS]),
}) satisfies Atom<Exam[]>;

/** Back to the defaults, for tests that share one page. */
export function resetPreferences() {
  themeAtom.reset();
  languageAtom.reset();
  scriptAtom.reset();
  backgroundAtom.reset();
  shownExamsAtom.reset();
}
