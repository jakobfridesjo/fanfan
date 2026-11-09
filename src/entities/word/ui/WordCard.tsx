import { LoaderCircle, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import type { StudyCard } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { useSpeakWord } from "@/entities/word/model/use-speak-word.ts";
import { ExamLevels } from "@/entities/word/ui/ExamLevels.tsx";
import { WordForms } from "@/entities/word/ui/WordForms.tsx";

const MAX_DEFINITIONS = 4;

interface WordCardProps {
  card: StudyCard;
  /** Hides pinyin and meanings for recall practice, keeping their space so revealing them moves nothing. */
  hidden?: boolean;
  footer?: ReactNode;
}

export function WordCard({ card, hidden = false, footer }: WordCardProps) {
  const m = useMessages();
  return (
    <Card className="min-h-96 w-full justify-between">
      <CardContent className="flex flex-col items-center gap-6 pt-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Headword card={card} className="text-6xl" />
            <SpeakButton word={card.word} />
          </div>
          {card.count !== null && (
            <p className="text-xs text-muted-foreground">{m.word.countInBook(card.count)}</p>
          )}
          <ExamLevels levels={card} className="justify-center" />
        </div>

        {card.example && (
          <p lang="zh" className="max-w-md text-lg leading-relaxed text-muted-foreground">
            <HighlightedWord sentence={card.example} word={card.displayWord} />
          </p>
        )}

        <div inert={hidden} className={cn("flex w-full justify-center", hidden && "invisible")}>
          <Readings card={card} />
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

export function SpeakButton({ word }: { word: string }) {
  const m = useMessages();
  const { speak, loading } = useSpeakWord(word);
  return (
    <TooltipIconButton
      label={m.word.playPronunciation}
      variant="ghost"
      size="icon"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => void speak()}
    >
      {loading ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Volume2 />}
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
            {reading.pinyin}
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
