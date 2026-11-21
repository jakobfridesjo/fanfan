import { For, Show } from "solid-js";
import { EXAMS, shownExamsAtom, type Exam } from "@/shared/config/preferences.ts";
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
export function ExamLevels(props: { levels: WordLevels; class?: string }) {
  const m = useMessages();
  const badges = () =>
    EXAMS.filter((exam) => shownExamsAtom().includes(exam)).flatMap((exam) => {
      const level = examLevel(props.levels, exam);
      return level === null ? [] : [{ exam, level }];
    });
  const label = (exam: Exam, level: number) =>
    ({ hsk: m.word.hskLevel, tbcl: m.word.tbclLevel, tocfl: m.word.tocflLevel })[exam](level);
  return (
    <Show when={badges().length > 0}>
      <ul aria-label={m.word.examLevels} class={cn("flex flex-wrap gap-1.5", props.class)}>
        <For each={badges()} keyed={(badge) => badge.exam}>
          {(badge) => (
            <li>
              <Badge variant="secondary" class={LEVEL_TONES[badge().level - 1]}>
                {label(badge().exam, badge().level)}
              </Badge>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
