import { LoaderCircle, Play } from "lucide-react";
import type { ReactNode } from "react";
import type { StudyCard } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { useSpeakWord } from "@/entities/word/model/use-speak-word.ts";
import { CangjieCodes } from "@/entities/word/ui/CangjieCodes.tsx";
import { ExamLevels } from "@/entities/word/ui/ExamLevels.tsx";
import { ReadingPronunciation } from "@/entities/word/ui/Pronunciation.tsx";
import { WordForms } from "@/entities/word/ui/WordForms.tsx";

const MAX_DEFINITIONS = 4;

interface WordCardProps {
  card: StudyCard;
  /** Hides the pronunciation and meanings for recall practice, keeping their space so revealing them moves nothing. */
  hidden?: boolean;
  /** Shown where the hidden meanings would be. */
  hiddenHint?: string;
  footer?: ReactNode;
}

export function WordCard({ card, hidden = false, hiddenHint, footer }: WordCardProps) {
  const m = useMessages();
  return (
    <Card className="relative min-h-96 w-full justify-between">
      <SpeakButton
        word={card.word}
        className="absolute top-(--card-spacing) right-(--card-spacing)"
      />
      <CardContent className="flex min-h-0 flex-col items-center gap-6 pt-6 text-center">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <Headword card={card} className="text-6xl" />
          {card.count !== null && (
            <p className="text-xs text-muted-foreground">{m.word.countInBook(card.count)}</p>
          )}
          <ExamLevels levels={card} className="justify-center" />
          <CangjieCodes card={card} className="items-center" />
        </div>

        {card.example && (
          <p lang="zh" className="max-w-md shrink-0 text-lg leading-relaxed text-muted-foreground">
            <HighlightedWord sentence={card.example} word={card.displayWord} />
          </p>
        )}

        <div className="relative flex min-h-0 w-full flex-col">
          <div
            inert={hidden}
            className={cn(
              "flex min-h-0 w-full justify-center overflow-y-auto",
              hidden && "invisible"
            )}
          >
            <Readings card={card} />
          </div>
          {hidden && hiddenHint && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {hiddenHint}
            </p>
          )}
        </div>
      </CardContent>
      {footer && <div className="px-(--card-spacing)">{footer}</div>}
    </Card>
  );
}

/** The word in the chosen script, with its traditional form beside it, alike, when both are shown. */
export function Headword({ card, className }: { card: StudyCard; className: string }) {
  return (
    <p lang="zh" className={cn("font-medium tracking-wide", className)}>
      <WordForms word={card.displayWord} alternate={card.alternateWord} />
    </p>
  );
}

/** A round play button, like the reader's; `ghost` sits quieter in a table row. */
export function SpeakButton({
  word,
  variant = "outline",
  className,
}: {
  word: string;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const m = useMessages();
  const { speak, loading } = useSpeakWord(word);
  return (
    <TooltipIconButton
      label={m.word.playPronunciation}
      variant={variant}
      size="icon"
      className={className}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => void speak()}
    >
      {loading ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Play />}
    </TooltipIconButton>
  );
}

function HighlightedWord({ sentence, word }: { sentence: string; word: string }) {
  const index = sentence.indexOf(word);
  if (index < 0) return sentence;
  return (
    <>
      {sentence.slice(0, index)}
      <mark className="rounded-sm bg-warning/20 px-0.5 text-foreground">{word}</mark>
      {sentence.slice(index + word.length)}
    </>
  );
}

export function Readings({ card }: { card: StudyCard }) {
  const m = useMessages();
  if (card.readings.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.word.noEntry}</p>;
  }
  return (
    <dl className="flex w-full max-w-md flex-col gap-3 text-left">
      {card.readings.map((reading) => (
        <div key={`${reading.pinyin}/${reading.definitions[0]}`} className="flex flex-col gap-0.5">
          <dt className="flex items-center gap-2 text-lg font-medium">
            <ReadingPronunciation reading={reading} />
            {reading.properNoun && <Badge variant="outline">{m.word.name}</Badge>}
          </dt>
          <dd className="text-sm text-muted-foreground">
            {reading.definitions.slice(0, MAX_DEFINITIONS).join("; ")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
