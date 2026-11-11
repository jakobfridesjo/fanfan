import { useSelector } from "@tanstack/react-store";
import { EXAMS, shownExamsAtom } from "@/shared/config/preferences.ts";
import { examLevel, type WordLevels } from "@/entities/word/model/exam-levels.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";

/** One tone per step, easiest first; every exam has seven. */
const LEVEL_TONES = [
  "bg-level-1/12 text-level-1",
  "bg-level-2/12 text-level-2",
  "bg-level-3/12 text-level-3",
  "bg-level-4/12 text-level-4",
  "bg-level-5/12 text-level-5",
  "bg-level-6/12 text-level-6",
  "bg-level-7/12 text-level-7",
] as const;

/** The word's HSK, TBCL and TOCFL levels, as far as the settings show them. */
export function ExamLevels({ levels, className }: { levels: WordLevels; className?: string }) {
  const m = useMessages();
  const shown = useSelector(shownExamsAtom);
  const labels = { hsk: m.word.hskLevel, tbcl: m.word.tbclLevel, tocfl: m.word.tocflLevel };
  const badges = EXAMS.filter((exam) => shown.includes(exam)).flatMap((exam) => {
    const level = examLevel(levels, exam);
    return level === null ? [] : [{ exam, level }];
  });
  if (badges.length === 0) return null;
  return (
    <ul aria-label={m.word.examLevels} className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map(({ exam, level }) => (
        <li key={exam}>
          <Badge variant="secondary" className={LEVEL_TONES[level - 1]}>
            {labels[exam](level)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
