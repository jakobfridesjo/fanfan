import type { JSX } from "@solidjs/web";
import { For, Show, untrack } from "solid-js";
import { ArrowDown, ArrowUp } from "lucide";
import { cn } from "@/shared/lib/class-names.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
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
  /** Scrolled to once the text is on the page; later changes are ignored. */
  initialParagraph: number;
  onParagraphReached: (paragraph: number) => void;
  /** Given what is on screen, for the reader to ask about; null once it is gone. */
  onView: (view: TextView | null) => void;
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
  footer: JSX.Element;
  /** The word drawer covers the bottom of the text, so the text can scroll past it. */
  drawerOpen: boolean;
}

/** Only the paragraphs in view are rendered: one EPUB chapter can be a whole book. */
export function SectionText(props: SectionTextProps) {
  const m = useMessages();
  const scroll = useSectionScroll({
    paragraphCount: () => props.section.paragraphs.length,
    initialParagraph: untrack(() => props.initialParagraph),
    onParagraphReached: (paragraph) => props.onParagraphReached(paragraph),
    spokenParagraph: () => props.spokenPhrase?.paragraph,
    spokenToken: () => props.spokenPhrase?.start,
    onView: (view) => props.onView(view),
  });
  let text: HTMLDivElement | undefined;
  const drag = useDragSelect({
    onHold: () => props.onHoldText(),
    onSelect: ({ anchor, focus }) => props.onSelectPassage(anchor, focus),
  });
  const highlighted = () => (drag.range ? ordered(drag.range) : props.passage);
  const toolbarPassage = () =>
    !drag.range && !props.passageActions.translationShown ? props.passage : null;

  return (
    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroll.scrollRef}
        class={cn(
          "min-h-0 flex-1 overflow-y-auto scroll-fade",
          props.drawerOpen && "scroll-pb-[45dvh]"
        )}
        data-testid="reader-text"
      >
        {/* A long press drags a selection, so the webview must not start its own. */}
        <div
          ref={(element) => {
            text = element;
            drag.captureClicks(element);
          }}
          class="relative mx-auto w-full max-w-2xl select-none [-webkit-touch-callout:none]"
          style={{ height: `${scroll.totalSize}px` }}
          onPointerDown={drag.onPointerDown}
          onClick={(event) => {
            if (event.target instanceof Element && !event.target.closest("button"))
              props.onTapText();
          }}
        >
          <Show when={toolbarPassage()}>
            {(passage) => (
              <SelectionToolbar
                passage={passage()}
                text={() => text}
                scroller={scroll.scrollElement}
                onTranslate={() => props.passageActions.onTranslate()}
                onListen={() => props.passageActions.onListen()}
                onCopy={() => props.passageActions.onCopy()}
              />
            )}
          </Show>
          <For each={scroll.items} keyed={(item) => item.key}>
            {(item) => (
              <div
                data-index={item().index}
                ref={scroll.measure}
                class="absolute inset-x-0 top-0 pb-5"
                style={{ transform: `translateY(${item().start}px)` }}
              >
                <Paragraph
                  index={item().index}
                  tokens={props.section.paragraphs[item().index] ?? []}
                  statusOf={props.statusOf}
                  selectedToken={
                    props.selectedToken?.paragraph === item().index
                      ? props.selectedToken.token
                      : null
                  }
                  onSelectToken={props.onSelectToken}
                  spoken={
                    props.spokenPhrase?.paragraph === item().index ? props.spokenPhrase : null
                  }
                  passage={rangeIn(
                    highlighted(),
                    item().index,
                    props.section.paragraphs[item().index]?.length ?? 0
                  )}
                />
              </div>
            )}
          </For>
        </div>
        {props.footer}
        <Show when={props.drawerOpen}>
          <div aria-hidden="true" class="h-[45dvh]" />
        </Show>
      </div>
      <Show when={scroll.spokenOutOfView}>
        {(side) => (
          <div
            class={cn(
              "pointer-events-none absolute inset-x-0 flex justify-center",
              props.drawerOpen ? "bottom-[calc(45dvh+1rem)]" : "bottom-4"
            )}
          >
            <Button
              variant="secondary"
              class="pointer-events-auto shadow-md"
              onClick={scroll.followSpoken}
            >
              <Show
                when={side() === "above"}
                fallback={<Icon icon={ArrowDown} data-icon="inline-start" />}
              >
                <Icon icon={ArrowUp} data-icon="inline-start" />
              </Show>
              {m.reader.backToReading}
            </Button>
          </div>
        )}
      </Show>
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
