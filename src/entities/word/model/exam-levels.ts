import type { StudyCard } from "@/shared/api/commands.ts";
import type { Exam } from "@/shared/config/preferences.ts";

export type WordLevels = Pick<StudyCard, "hskLevel" | "tbclLevel" | "tocflLevel">;

const LEVEL_FIELDS = {
  hsk: "hskLevel",
  tbcl: "tbclLevel",
  tocfl: "tocflLevel",
} as const satisfies Record<Exam, keyof WordLevels>;

/** The word's level in the exam, 1 to 7; null when the word is not on its list. */
export function examLevel(levels: WordLevels, exam: Exam): number | null {
  return levels[LEVEL_FIELDS[exam]];
}
