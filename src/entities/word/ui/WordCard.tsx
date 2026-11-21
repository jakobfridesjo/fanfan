import { LoaderCircle, Volume2 } from "lucide";
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import type { StudyCard } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
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
  footer?: JSX.Element;
}

export function WordCard(props: WordCardProps) {
  const m = useMessages();
  return (
    <Card class="relative min-h-96 w-full justify-between">
      <SpeakButton
        word={props.card.word}
        class="absolute top-(--card-spacing) right-(--card-spacing)"
      />
      <CardContent class="flex min-h-0 flex-col items-center gap-6 pt-6 text-center">
        <div class="flex shrink-0 flex-col items-center gap-3">
          <Headword card={props.card} class="text-6xl" />
          <Show when={props.card.count !== null}>
            <p class="text-xs text-muted-foreground">{m.word.countInBook(props.card.count ?? 0)}</p>
          </Show>
          <ExamLevels levels={props.card} class="justify-center" />
          <CangjieCodes card={props.card} class="items-center" />
        </div>

        <Show when={props.card.example}>
          {(example) => (
            <p lang="zh" class="max-w-md shrink-0 text-lg leading-relaxed text-muted-foreground">
              <HighlightedWord sentence={example()} word={props.card.displayWord} />
            </p>
          )}
        </Show>

        <div class="relative flex min-h-0 w-full flex-col">
          <div
            inert={props.hidden}
            class={cn(
              "flex min-h-0 w-full justify-center overflow-y-auto scroll-fade",
              props.hidden && "invisible"
            )}
          >
            <Readings card={props.card} />
          </div>
          <Show when={props.hidden && props.hiddenHint}>
            <p class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {props.hiddenHint}
            </p>
          </Show>
        </div>
      </CardContent>
      <Show when={props.footer}>
        <div class="px-(--card-spacing)">{props.footer}</div>
      </Show>
    </Card>
  );
}

/** The word in the chosen script, with its traditional form beside it, alike, when both are shown. */
export function Headword(props: { card: StudyCard; class: string }) {
  return (
    <p lang="zh" class={cn("font-medium tracking-wide", props.class)}>
      <WordForms word={props.card.displayWord} alternate={props.card.alternateWord} />
    </p>
  );
}

/** A round play button, like the reader's; `ghost` sits quieter in a table row. */
export function SpeakButton(props: {
  word: string;
  variant?: "outline" | "ghost";
  class?: string;
}) {
  const m = useMessages();
  const speech = useSpeakWord(() => props.word);
  return (
    <TooltipIconButton
      label={m.word.playPronunciation}
      variant={props.variant ?? "outline"}
      size="icon"
      class={props.class}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => void speech.speak()}
    >
      <Show when={speech.loading()} fallback={<Icon icon={Volume2} />}>
        <Icon icon={LoaderCircle} class="animate-spin motion-reduce:animate-none" />
      </Show>
    </TooltipIconButton>
  );
}

function HighlightedWord(props: { sentence: string; word: string }) {
  const index = () => props.sentence.indexOf(props.word);
  return (
    <Show when={index() >= 0} fallback={props.sentence}>
      {props.sentence.slice(0, index())}
      <mark class="rounded-sm bg-warning/20 px-0.5 text-foreground">{props.word}</mark>
      {props.sentence.slice(index() + props.word.length)}
    </Show>
  );
}

export function Readings(props: { card: StudyCard }) {
  const m = useMessages();
  return (
    <Show
      when={props.card.readings.length > 0}
      fallback={<p class="text-sm text-muted-foreground">{m.word.noEntry}</p>}
    >
      <dl class="flex w-full max-w-md flex-col gap-3 text-left">
        <For each={props.card.readings}>
          {(reading) => (
            <div class="flex flex-col gap-0.5">
              <dt class="flex items-center gap-2 text-lg font-medium">
                <ReadingPronunciation reading={reading} />
                <Show when={reading.properNoun}>
                  <Badge variant="outline">{m.word.name}</Badge>
                </Show>
              </dt>
              <dd class="text-sm text-muted-foreground">
                {reading.definitions.slice(0, MAX_DEFINITIONS).join("; ")}
              </dd>
            </div>
          )}
        </For>
      </dl>
    </Show>
  );
}
