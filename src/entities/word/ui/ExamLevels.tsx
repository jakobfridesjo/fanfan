import { useSelector } from "@tanstack/react-store";
import { TOCFL_LEVELS, type StudyCard } from "@/shared/api/commands.ts";
import { shownExamsAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";

type WordLevels = Pick<StudyCard, "hskLevel" | "tocflLevel">;

/** One tone per step, easiest first; both exams have seven. */
const LEVEL_TONES = [
  "bg-level-1/12 text-level-1",
  "bg-level-2/12 text-level-2",
  "bg-level-3/12 text-level-3",
  "bg-level-4/12 text-level-4",
  "bg-level-5/12 text-level-5",
  "bg-level-6/12 text-level-6",
  "bg-level-7/12 text-level-7",
] as const;

/** The word's HSK and TOCFL levels, as far as the settings show them. */
export function ExamLevels({ levels, className }: { levels: WordLevels; className?: string }) {
  const m = useMessages();
  const exams = useSelector(shownExamsAtom);
  const hsk = exams.includes("hsk") ? levels.hskLevel : null;
  const tocfl = exams.includes("tocfl") ? levels.tocflLevel : null;
  if (hsk === null && tocfl === null) return null;
  return (
    <ul aria-label={m.word.examLevels} className={cn("flex flex-wrap gap-1.5", className)}>
      {hsk !== null && (
        <li>
          <Badge variant="secondary" className={LEVEL_TONES[hsk - 1]}>
            {m.word.hskLevel(hsk)}
          </Badge>
        </li>
      )}
      {tocfl !== null && (
        <li>
          <Badge variant="secondary" className={LEVEL_TONES[TOCFL_LEVELS.indexOf(tocfl)]}>
            {m.word.tocflLevel(tocfl)}
          </Badge>
        </li>
      )}
    </ul>
  );
}
