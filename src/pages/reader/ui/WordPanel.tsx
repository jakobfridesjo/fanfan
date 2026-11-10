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
  const { word, passage } = props;
  if (word) return <WordDetails {...props} word={word} />;
  if (passage) return <PassageTranslation {...passage} />;
  return null;
}

export function WordPanel(props: WordPanelProps) {
  const m = useMessages();
  const subject = props.word ?? props.passage?.text ?? null;
  return (
    <Card size="sm" aria-label={subject ?? undefined}>
      <CardContent className="flex flex-col gap-4">
        {subject ? (
          <PanelDetails {...props} />
        ) : (
          <p className="text-sm text-muted-foreground">{m.reader.pickWord}</p>
        )}
      </CardContent>
    </Card>
  );
}

type WordDetailsProps = WordPanelProps & { word: string };

function WordDetails({ word, card, loading, failed, status, onSetStatus }: WordDetailsProps) {
  const m = useMessages();
  return (
    <>
      {loading ? (
        <Skeleton className="h-32 w-full motion-reduce:animate-none" />
      ) : failed || !card ? (
        <p className="text-sm text-muted-foreground">{m.reader.wordFailed}</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Headword card={card} className="text-4xl" />
            <SpeakButton word={card.word} className="ml-auto" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
            {status && (
              <Badge className={STATUS_BADGE_CLASS[status]}>{m.reader.statuses[status]}</Badge>
            )}
            <ExamLevels levels={card} />
          </div>
          <CangjieCodes card={card} />
          <Readings card={card} />
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={status === "learning" ? "default" : "outline"}
          disabled={status === "learning"}
          onClick={() => onSetStatus(word, "learning")}
        >
          {m.reader.learnIt}
        </Button>
        <Button
          type="button"
          variant={status === "known" ? "default" : "outline"}
          disabled={status === "known"}
          onClick={() => onSetStatus(word, "known")}
        >
          {m.reader.knowIt}
        </Button>
      </div>
    </>
  );
}
