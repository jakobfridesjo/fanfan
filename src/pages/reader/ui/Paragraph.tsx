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

interface ParagraphProps {
  index: number;
  tokens: ReaderToken[];
  statusOf: (word: string) => ReaderWordStatus;
  /** The index of the tapped token, when it is in this paragraph. */
  selectedToken: number | null;
  onSelectToken: SelectToken;
  /** The phrase being read aloud, when it is in this paragraph. */
  spoken: SpokenPhrase | null;
}

export function Paragraph({
  index: paragraph,
  tokens,
  statusOf,
  selectedToken,
  onSelectToken,
  spoken,
}: ParagraphProps) {
  return (
    <p lang="zh" className="text-xl leading-loose">
      {tokens.map((token, index) => {
        const key = `${index}`;
        const isSpoken = spoken !== null && index >= spoken.start && index < spoken.end;
        const spokenProps = isSpoken ? { "data-spoken": true } : {};
        const status = token.word ? statusOf(token.word) : null;
        const text = (
          <span
            className={cn(
              "pb-[0.2em]",
              status && WORD_STATUS_CLASS[status],
              isSpoken && SPOKEN_CLASS,
              isSpoken && index === spoken.start && "rounded-l-md",
              isSpoken && index === spoken.end - 1 && "rounded-r-md"
            )}
          >
            {token.text}
          </span>
        );
        if (!token.word) {
          return (
            <span key={key} {...spokenProps}>
              {text}
            </span>
          );
        }
        const word = token.word;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={index === selectedToken}
            data-status={status ?? undefined}
            {...spokenProps}
            onClick={(event) => {
              const button = event.currentTarget;
              onSelectToken(word, { paragraph, token: index });
              // After the render that may open the word drawer and pad the text below it.
              requestAnimationFrame(() => button.scrollIntoView({ block: "nearest" }));
            }}
            className={cn(
              "cursor-pointer rounded-sm transition-colors outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              index === selectedToken && "bg-primary/30 hover:bg-primary/30"
            )}
          >
            {token.alternate ? (
              <ruby>
                {text}
                <rt className="text-[1em]">{token.alternate}</rt>
              </ruby>
            ) : (
              text
            )}
          </button>
        );
      })}
    </p>
  );
}
