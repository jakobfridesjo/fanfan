import { type ReactNode, type RefObject, useRef } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/shared/lib/class-names.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import type { ReaderSection, SpokenPhrase } from "@/shared/api/commands.ts";
import { type DragRange, useDragSelect } from "@/pages/reader/model/use-drag-select.ts";
import type {
  Passage,
  ReaderWordStatus,
  TokenPosition,
} from "@/pages/reader/model/use-reader-manager.ts";
import { type TextView, useSectionScroll } from "@/pages/reader/model/use-section-scroll.ts";
import { Paragraph, type SelectToken, type TokenRange } from "@/pages/reader/ui/Paragraph.tsx";
import { SelectionToolbar } from "@/pages/reader/ui/SelectionToolbar.tsx";

/** What the selection toolbar does with the passage. */
interface PassageActions {
  translationShown: boolean;
  onTranslate: () => void;
  onListen: () => void;
  onCopy: () => void;
}

interface SectionTextProps {
  section: ReaderSection;
  /** Scrolled to on mount; later changes are ignored. */
  initialParagraph: number;
  onParagraphReached: (paragraph: number) => void;
  /** Where the reader finds what is on screen. */
  viewRef: RefObject<TextView | null>;
  statusOf: (word: string) => ReaderWordStatus;
  selectedToken: TokenPosition | null;
  onSelectToken: SelectToken;
  spokenPhrase: SpokenPhrase | null;
  /** The dragged-over passage, with a toolbar of what to do with it. */
  passage: Passage | null;
  passageActions: PassageActions;
  /** A press has held still long enough to start a selection. */
  onHoldText: () => void;
  onSelectPassage: (anchor: TokenPosition, focus: TokenPosition) => void;
  /** A tap on the text away from every word. */
  onTapText: () => void;
  footer: ReactNode;
  /** The word drawer covers the bottom of the text, so the text can scroll past it. */
  drawerOpen: boolean;
}

/** Only the paragraphs in view are rendered: one EPUB chapter can be a whole book. */
export function SectionText({
  section,
  initialParagraph,
  onParagraphReached,
  viewRef,
  statusOf,
  selectedToken,
  onSelectToken,
  spokenPhrase,
  passage,
  passageActions,
  onHoldText,
  onSelectPassage,
  onTapText,
  footer,
  drawerOpen,
}: SectionTextProps) {
  const m = useMessages();
  const { scrollRef, measureElement, items, totalSize, spokenOutOfView, followSpoken } =
    useSectionScroll({
      paragraphCount: section.paragraphs.length,
      initialParagraph,
      onParagraphReached,
      spokenParagraph: spokenPhrase?.paragraph,
      viewRef,
    });
  const textRef = useRef<HTMLDivElement>(null);
  const drag = useDragSelect({
    onHold: onHoldText,
    onSelect: ({ anchor, focus }) => onSelectPassage(anchor, focus),
  });
  const highlighted = drag.range ? ordered(drag.range) : passage;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto scroll-fade",
          drawerOpen && "scroll-pb-[45dvh]"
        )}
        data-testid="reader-text"
      >
        {/* A long press drags a selection, so the webview must not start its own. */}
        <div
          ref={textRef}
          className="relative mx-auto w-full max-w-2xl select-none [-webkit-touch-callout:none]"
          style={{ height: totalSize }}
          onPointerDown={drag.onPointerDown}
          onClickCapture={drag.onClickCapture}
          onClick={(event) => {
            if (event.target instanceof Element && !event.target.closest("button")) onTapText();
          }}
        >
          {passage && !drag.range && !passageActions.translationShown && (
            <SelectionToolbar
              passage={passage}
              textRef={textRef}
              scrollRef={scrollRef}
              onTranslate={passageActions.onTranslate}
              onListen={passageActions.onListen}
              onCopy={passageActions.onCopy}
            />
          )}
          {items.map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              ref={measureElement}
              className="absolute inset-x-0 top-0 pb-5"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <Paragraph
                index={item.index}
                tokens={section.paragraphs[item.index] ?? []}
                statusOf={statusOf}
                selectedToken={selectedToken?.paragraph === item.index ? selectedToken.token : null}
                onSelectToken={onSelectToken}
                spoken={spokenPhrase?.paragraph === item.index ? spokenPhrase : null}
                passage={rangeIn(
                  highlighted,
                  item.index,
                  section.paragraphs[item.index]?.length ?? 0
                )}
              />
            </div>
          ))}
        </div>
        {footer}
        {drawerOpen && <div aria-hidden className="h-[45dvh]" />}
      </div>
      {spokenOutOfView && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 flex justify-center",
            drawerOpen ? "bottom-[calc(45dvh+1rem)]" : "bottom-4"
          )}
        >
          <Button
            type="button"
            variant="secondary"
            className="pointer-events-auto shadow-md"
            onClick={followSpoken}
          >
            {spokenOutOfView === "above" ? (
              <ArrowUp data-icon="inline-start" />
            ) : (
              <ArrowDown data-icon="inline-start" />
            )}
            {m.reader.backToReading}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The tokens of `passage` in `paragraph`, which has `length` tokens. */
function rangeIn(passage: Passage | null, paragraph: number, length: number): TokenRange | null {
  if (!passage || paragraph < passage.from.paragraph || paragraph > passage.to.paragraph) {
    return null;
  }
  return {
    start: paragraph === passage.from.paragraph ? passage.from.token : 0,
    end: paragraph === passage.to.paragraph ? passage.to.token + 1 : length,
  };
}

function ordered({ anchor, focus }: DragRange): Passage {
  const anchorFirst =
    anchor.paragraph < focus.paragraph ||
    (anchor.paragraph === focus.paragraph && anchor.token <= focus.token);
  return anchorFirst ? { from: anchor, to: focus } : { from: focus, to: anchor };
}
