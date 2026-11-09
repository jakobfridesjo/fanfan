import type { ReaderToken, SpokenPhrase } from "@/shared/api/commands.ts";
import { cn } from "@/shared/lib/class-names.ts";
import type { ReaderWordStatus } from "@/pages/reader/model/use-reader-manager.ts";

export type SelectToken = (word: string, position: { paragraph: number; token: number }) => void;

const WORD_STATUS_CLASS: Record<NonNullable<ReaderWordStatus>, string> = {
  unseen: "bg-primary/10 hover:bg-primary/20",
  learning: "bg-warning/25 hover:bg-warning/40",
  known: "hover:bg-muted",
};

/** A soft line under the phrase being read aloud. */
const SPOKEN_CLASS =
  "underline decoration-primary/50 decoration-2 underline-offset-[0.4em] [text-decoration-skip-ink:none]";

interface ParagraphProps {
  index: number;
  tokens: ReaderToken[];
  statusOf: (word: string) => ReaderWordStatus;
  selectedWord: string | null;
  onSelectToken: SelectToken;
  /** The phrase being read aloud, when it is in this paragraph. */
  spoken: SpokenPhrase | null;
}

export function Paragraph({
  index: paragraph,
  tokens,
  statusOf,
  selectedWord,
  onSelectToken,
  spoken,
}: ParagraphProps) {
  return (
    <p lang="zh" className="text-xl leading-loose">
      {tokens.map((token, index) => {
        const key = `${index}`;
        const isSpoken = spoken !== null && index >= spoken.start && index < spoken.end;
        const spokenProps = isSpoken ? { "data-spoken": true } : {};
        if (!token.word) {
          return (
            <span key={key} {...spokenProps} className={cn(isSpoken && SPOKEN_CLASS)}>
              {token.text}
            </span>
          );
        }
        const word = token.word;
        const status = statusOf(word);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={word === selectedWord}
            data-status={status ?? undefined}
            {...spokenProps}
            onClick={() => onSelectToken(word, { paragraph, token: index })}
            className={cn(
              "cursor-pointer rounded-sm px-px transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              status && WORD_STATUS_CLASS[status],
              word === selectedWord && "ring-2 ring-ring",
              isSpoken && SPOKEN_CLASS
            )}
          >
            {token.text}
          </button>
        );
      })}
    </p>
  );
}
