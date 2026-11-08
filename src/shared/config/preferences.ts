import { createAtom, type Atom } from "@tanstack/react-store";
import * as z from "zod/mini";
import { persistedString } from "@/shared/lib/persisted-value.ts";

export const LANGUAGES = ["en", "sv", "zh"] as const;
export const SCRIPTS = ["simplified", "traditional"] as const;
export const BACKGROUNDS = ["fireflies", "sea", "cherry", "mist", "sunset", "plain"] as const;

export type Language = (typeof LANGUAGES)[number];
/** The characters Chinese words are shown in; Rust converts them. */
export type Script = (typeof SCRIPTS)[number];
export type Background = (typeof BACKGROUNDS)[number];

/** A preference kept in `localStorage`, readable outside React (query keys, formatters). */
function persistedAtom<T extends string>(key: string, values: readonly [T, ...T[]], fallback: T) {
  const stored = persistedString<T>({ key, schema: z.enum(values), fallback });
  const atom = createAtom(stored.load());
  atom.subscribe((value) => stored.save(value));
  return Object.assign(atom, { reset: () => atom.set(fallback) }) satisfies Atom<T>;
}

export const languageAtom = persistedAtom<Language>("language", LANGUAGES, "en");
export const scriptAtom = persistedAtom<Script>("script", SCRIPTS, "simplified");
export const backgroundAtom = persistedAtom<Background>("background", BACKGROUNDS, "fireflies");

/** Back to the defaults, for tests that share one page. */
export function resetPreferences() {
  languageAtom.reset();
  scriptAtom.reset();
  backgroundAtom.reset();
}
