import type { StudyCard, WordStatus } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { Readings, SpeakButton } from "@/entities/word/ui/WordCard.tsx";
import type { ReaderWordStatus } from "@/pages/reader/model/use-reader-manager.ts";

interface WordPanelProps {
  word: string | null;
  card: StudyCard | undefined;
  loading: boolean;
  failed: boolean;
  status: ReaderWordStatus;
  onSetStatus: (word: string, status: WordStatus) => void;
}

export function WordPanel({ word, card, loading, failed, status, onSetStatus }: WordPanelProps) {
  const m = useMessages();
  if (!word) {
    return (
      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">{m.reader.pickWord}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card size="sm" aria-label={word}>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <Skeleton className="h-32 w-full motion-reduce:animate-none" />
        ) : failed || !card ? (
          <p className="text-sm text-muted-foreground">{m.reader.wordFailed}</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <p lang="zh" className="text-4xl font-medium tracking-wide">
                {card.displayWord}
              </p>
              <SpeakButton word={card.word} />
              {status && (
                <Badge variant="outline" className="ml-auto">
                  {m.reader.statuses[status]}
                </Badge>
              )}
            </div>
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
      </CardContent>
    </Card>
  );
}
