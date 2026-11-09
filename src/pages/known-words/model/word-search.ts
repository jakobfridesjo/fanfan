import type { WordEntry } from "@/shared/api/commands.ts";

/** Lowercase without tone marks, so "nihao" finds "nǐ hǎo" and "ㄋㄧ" finds "ㄋㄧˇ". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\p{M}ˊˇˋ˙]/gu, "")
    .toLowerCase();

const compact = (text: string) => text.replace(/\s+/g, "");

/** Whether `query` occurs in the word, in either script, or in any reading's pinyin, zhuyin or definitions. */
export function matchesWordSearch(entry: WordEntry, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  const fields = [
    entry.word,
    entry.displayWord,
    entry.alternateWord ?? "",
    ...entry.readings.flatMap((reading) => [
      reading.pinyin,
      reading.zhuyin,
      ...reading.definitions,
    ]),
  ];
  return fields.some((field) => {
    const folded = fold(field);
    return folded.includes(needle) || compact(folded).includes(compact(needle));
  });
}
