import { For, Show } from "solid-js";
import { ariaBoolean } from "@/shared/lib/aria.ts";
import type { ReaderToken, SpokenPhrase } from "@/shared/api/commands.ts";
import { cn } from "@/shared/lib/class-names.ts";
import type { ReaderWordStatus } from "@/pages/reader/model/use-reader-manager.ts";

export type SelectToken = (word: string, position: { paragraph: number; token: number }) => void;

/**
 * A line under the word's characters, inset at both ends so neighbouring words stay apart. It
 * sits in the padding below them, where the read-aloud wash reaches too.
 */
const UNDERLINE_CLASS = "bg-bottom bg-no-repeat bg-size-[calc(100%-0.3em)_2px]";

const WORD_STATUS_CLASS: Record<NonNullable<ReaderWordStatus>, string> = {
  unseen: cn(
    UNDERLINE_CLASS,
    "bg-[image:linear-gradient(--alpha(var(--color-primary)/70%),--alpha(var(--color-primary)/70%))]"
  ),
  learning: cn(
    UNDERLINE_CLASS,
    "bg-[image:repeating-linear-gradient(to_right,--alpha(var(--color-warning)/70%)_0_0.3em,transparent_0.3em_0.5em)]"
  ),
  known: "",
};

/**
 * A soft wash over the phrase being read aloud, down to its underlines. It sits on the characters'
 * own line, not on the whole word with its alternate script above, so it runs as one even band.
 */
const SPOKEN_CLASS = "bg-primary/15";

/** A fainter wash over the passage the word panel translates. */
const PASSAGE_CLASS = "bg-foreground/8";

/** Tokens `start` up to `end` of a paragraph. */
export interface TokenRange {
  start: number;
  end: number;
}

/** `className` over the tokens in `range`, rounded at both ends. */
function washClass(range: TokenRange | null, index: number, className: string) {
  if (!range || index < range.start || index >= range.end) return false;
  return cn(
    className,
    index === range.start && "rounded-l-md",
    index === range.end - 1 && "rounded-r-md"
  );
}

interface ParagraphProps {
  index: number;
  tokens: ReaderToken[];
  statusOf: (word: string) => ReaderWordStatus;
  /** The index of the tapped token, when it is in this paragraph. */
  selectedToken: number | null;
  onSelectToken: SelectToken;
  /** The phrase being read aloud, when it is in this paragraph. */
  spoken: SpokenPhrase | null;
  /** The part of the selected passage in this paragraph. */
  passage: TokenRange | null;
}

export function Paragraph(props: ParagraphProps) {
  return (
    <p lang="zh" data-paragraph={props.index} class="text-xl leading-loose">
      <For each={props.tokens} keyed={false}>
        {(token, index) => {
          const isSpoken = () =>
            props.spoken !== null && index >= props.spoken.start && index < props.spoken.end;
          const status = () => {
            const word = token().word;
            return word ? props.statusOf(word) : null;
          };
          const selected = () => index === props.selectedToken;
          const text = () => {
            const wordStatus = status();
            return (
              <span
                class={cn(
                  "pb-[0.2em]",
                  wordStatus && WORD_STATUS_CLASS[wordStatus],
                  washClass(props.passage, index, PASSAGE_CLASS),
                  washClass(props.spoken, index, SPOKEN_CLASS)
                )}
              >
                <CharacterReadings text={token().text} reading={token().reading} />
              </span>
            );
          };
          return (
            <Show
              when={token().word}
              fallback={
                <span data-token={index} data-spoken={isSpoken() ? "true" : undefined}>
                  {text()}
                </span>
              }
            >
              {(word) => (
                <button
                  type="button"
                  aria-pressed={ariaBoolean(selected())}
                  // Each character's own ruby would otherwise have the word read out a character at a time.
                  aria-label={token().reading.length > 0 ? token().text : undefined}
                  data-token={index}
                  data-status={status() ?? undefined}
                  data-spoken={isSpoken() ? "true" : undefined}
                  onClick={(event) => {
                    const button = event.currentTarget;
                    props.onSelectToken(word(), { paragraph: props.index, token: index });
                    // After the render that may open the word drawer and pad the text below it.
                    requestAnimationFrame(() => button.scrollIntoView({ block: "nearest" }));
                  }}
                  class={cn(
                    "cursor-pointer rounded-sm transition-colors outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                    selected() && "bg-primary/30 hover:bg-primary/30"
                  )}
                >
                  <Show when={token().alternate} fallback={text()}>
                    <ruby>
                      {text()}
                      <rt class="text-[1em]">{token().alternate}</rt>
                    </ruby>
                  </Show>
                </button>
              )}
            </Show>
          );
        }}
      </For>
    </p>
  );
}

/** Each character with its syllable small above it, when the reader shows readings. */
function CharacterReadings(props: { text: string; reading: string[] }) {
  const characters = () => Array.from(props.text);
  return (
    <Show when={props.reading.length === characters().length} fallback={props.text}>
      <For each={characters()} keyed={false}>
        {(character, index) => (
          <Show when={props.reading[index]} fallback={character()}>
            <ruby class="[ruby-align:center]">
              {character()}
              <rt class="px-[0.15em] text-[0.5em] font-normal">{props.reading[index]}</rt>
            </ruby>
          </Show>
        )}
      </For>
    </Show>
  );
}
