import { Match, Show, Switch } from "solid-js";
import type { StudyCard, WordStatus } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { CangjieCodes } from "@/entities/word/ui/CangjieCodes.tsx";
import { ExamLevels } from "@/entities/word/ui/ExamLevels.tsx";
import { Headword, Readings, SpeakButton } from "@/entities/word/ui/WordCard.tsx";
import type { ReaderWordStatus } from "@/pages/reader/model/use-reader-manager.ts";
import {
  PassageTranslation,
  type PassageTranslationProps,
} from "@/pages/reader/ui/PassageTranslation.tsx";

/** Solid, in the colour the word has in the text, so it stands apart from the tinted exam levels. */
const STATUS_BADGE_CLASS: Record<NonNullable<ReaderWordStatus>, string> = {
  unseen: "bg-primary text-primary-foreground",
  learning: "bg-warning text-warning-foreground",
  known: "bg-success text-success-foreground",
};

export interface WordPanelProps {
  word: string | null;
  card: StudyCard | undefined;
  loading: boolean;
  failed: boolean;
  status: ReaderWordStatus;
  onSetStatus: (word: string, status: WordStatus) => void;
  /** A dragged-over passage, shown in place of a word. */
  passage: PassageTranslationProps | null;
}

export function PanelDetails(props: WordPanelProps) {
  return (
    <Switch>
      <Match when={props.word}>{(word) => <WordDetails {...props} word={word()} />}</Match>
      <Match when={props.passage}>{(passage) => <PassageTranslation {...passage()} />}</Match>
    </Switch>
  );
}

export function WordPanel(props: WordPanelProps) {
  const m = useMessages();
  const subject = () => props.word ?? props.passage?.text ?? null;
  return (
    <Card size="sm" aria-label={subject() ?? undefined}>
      <CardContent class="flex flex-col gap-4">
        <Show
          when={subject()}
          fallback={<p class="text-sm text-muted-foreground">{m.reader.pickWord}</p>}
        >
          <PanelDetails {...props} />
        </Show>
      </CardContent>
    </Card>
  );
}

type WordDetailsProps = WordPanelProps & { word: string };

function WordDetails(props: WordDetailsProps) {
  const m = useMessages();
  return (
    <>
      <Switch>
        <Match when={props.loading}>
          <Skeleton class="h-32 w-full motion-reduce:animate-none" />
        </Match>
        <Match when={!props.failed && props.card}>
          {(card) => (
            <>
              <div class="flex items-center gap-2">
                <Headword card={card()} class="text-4xl" />
                <SpeakButton word={card().word} class="ml-auto" />
              </div>
              <div class="flex flex-wrap items-center gap-1.5 empty:hidden">
                <Show when={props.status}>
                  {(status) => (
                    <Badge class={STATUS_BADGE_CLASS[status()]}>
                      {m.reader.statuses[status()]}
                    </Badge>
                  )}
                </Show>
                <ExamLevels levels={card()} />
              </div>
              <CangjieCodes card={card()} />
              <Readings card={card()} />
            </>
          )}
        </Match>
        <Match when={true}>
          <p class="text-sm text-muted-foreground">{m.reader.wordFailed}</p>
        </Match>
      </Switch>
      <div class="grid grid-cols-2 gap-2">
        <Button
          variant={props.status === "learning" ? "default" : "outline"}
          disabled={props.status === "learning"}
          onClick={() => props.onSetStatus(props.word, "learning")}
        >
          {m.reader.learnIt}
        </Button>
        <Button
          variant={props.status === "known" ? "default" : "outline"}
          disabled={props.status === "known"}
          onClick={() => props.onSetStatus(props.word, "known")}
        >
          {m.reader.knowIt}
        </Button>
      </div>
    </>
  );
}
