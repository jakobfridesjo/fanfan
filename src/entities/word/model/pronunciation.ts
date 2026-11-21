import type { Reading } from "@/shared/api/commands.ts";
import type { Notation } from "@/shared/config/preferences.ts";

/** The reading in the shown pronunciations, as plain text for sorting; empty when neither is shown. */
export function pronunciationText(reading: Reading, notations: Notation[]): string {
  return [
    notations.includes("pinyin") ? reading.pinyin : "",
    notations.includes("zhuyin") ? reading.zhuyin : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Whether the settings show a pronunciation at all. */
export function showsPronunciation(notations: Notation[]): boolean {
  return notations.includes("pinyin") || notations.includes("zhuyin");
}
