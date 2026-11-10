import {
  type RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/** A first guess at a paragraph's height in pixels, before it is measured. */
const ESTIMATED_PARAGRAPH_HEIGHT = 96;

/**
 * Where in the view, as fractions of its height, the spoken phrase may start before the text
 * glides it back to the middle: a little drift between moves keeps the text from crawling.
 */
const SPOKEN_BAND = { top: 0.3, bottom: 0.6 };

/** A token in the section, as `data-paragraph` and `data-token` mark it in the text. */
interface TextPosition {
  paragraph: number;
  token: number;
}

/** What the reader asks of the text on screen, such as where reading aloud should start. */
export interface TextView {
  /** The first token whose line is wholly in view. */
  firstToken: () => TextPosition | null;
  /** Whether any of the token at `position` is in view. */
  shows: (position: TextPosition) => boolean;
}

interface SectionScrollOptions {
  paragraphCount: number;
  /** Scrolled to on mount; later changes are ignored. */
  initialParagraph: number;
  onParagraphReached: (paragraph: number) => void;
  /** The paragraph being read aloud, kept in view until the reader scrolls it away. */
  spokenParagraph: number | undefined;
  /** The token the spoken phrase starts at. */
  spokenToken: number | undefined;
  viewRef: RefObject<TextView | null>;
}

/** Virtualizes a section's paragraphs, restores the reading position and follows read-aloud. */
export function useSectionScroll({
  paragraphCount,
  initialParagraph,
  onParagraphReached,
  spokenParagraph,
  spokenToken,
  viewRef,
}: SectionScrollOptions) {
  "use no memo";
  const scrollRef = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line react/incompatible-library -- "use no memo" above, and callers get only fresh values and the stable measureElement
  const virtualizer = useVirtualizer({
    count: paragraphCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_PARAGRAPH_HEIGHT,
    overscan: 6,
    onChange: (instance) => {
      const first = instance.range?.startIndex;
      if (first !== undefined) onParagraphReached(first);
    },
  });

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (initialParagraph > 0) virtualizer.scrollToIndex(initialParagraph, { align: "start" });
  }, [virtualizer, initialParagraph]);

  useImperativeHandle(viewRef, () => ({
    firstToken: () => {
      const element = scrollRef.current;
      if (!element) return null;
      const { top, bottom } = viewport(element);
      for (const token of element.querySelectorAll<HTMLElement>("[data-token]")) {
        const box = token.getBoundingClientRect();
        if (box.top >= top && box.top < bottom) return positionOf(token);
      }
      return null;
    },
    shows: ({ paragraph, token }) => {
      const element = scrollRef.current;
      const target = element?.querySelector(
        `[data-paragraph="${paragraph}"] [data-token="${token}"]`
      );
      if (!element || !target) return false;
      const { top, bottom } = viewport(element);
      const box = target.getBoundingClientRect();
      return box.bottom > top && box.top < bottom;
    },
  }));

  /** Whether read-aloud scrolls the text along; scrolling the spoken paragraph away stops it. */
  const [following, setFollowing] = useState(true);
  const range = virtualizer.range;
  const spokenInRange =
    spokenParagraph !== undefined &&
    range !== null &&
    spokenParagraph >= range.startIndex &&
    spokenParagraph <= range.endIndex;
  // Reading stopped, or reached the text the reader scrolled to: follow it again.
  if (!following && (spokenParagraph === undefined || spokenInRange)) setFollowing(true);

  const spokenRef = useRef(spokenParagraph);
  useEffect(() => {
    spokenRef.current = spokenParagraph;
  });

  // Read-aloud's own scrolling lands on the spoken paragraph, so only the reader scrolls it away.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => {
      const spoken = spokenRef.current;
      const item = spoken === undefined ? undefined : virtualizer.measurementsCache[spoken];
      if (!item) return;
      const top = element.scrollTop;
      setFollowing(item.end > top && item.start < top + element.clientHeight);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [virtualizer]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !following || spokenParagraph === undefined || spokenToken === undefined)
      return;
    let frame = 0;
    const center = (rendered: boolean) => {
      const token = element.querySelector(
        `[data-paragraph="${spokenParagraph}"] [data-token="${spokenToken}"]`
      );
      if (!token) {
        // Not rendered yet: bring its paragraph in, then place the phrase once it is.
        if (rendered) return;
        virtualizer.scrollToIndex(spokenParagraph, { align: "center" });
        frame = requestAnimationFrame(() => center(true));
        return;
      }
      const { top, bottom } = viewport(element);
      const height = bottom - top;
      const at = token.getBoundingClientRect().top - top;
      if (at >= height * SPOKEN_BAND.top && at <= height * SPOKEN_BAND.bottom) return;
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollBy({ top: at - height / 2, behavior: smooth ? "smooth" : "instant" });
    };
    center(false);
    return () => cancelAnimationFrame(frame);
  }, [virtualizer, spokenParagraph, spokenToken, following]);

  return {
    scrollRef,
    measureElement: virtualizer.measureElement,
    items: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    /** Where the spoken paragraph lies once the reader scrolled away from it. */
    spokenOutOfView:
      following || spokenParagraph === undefined || spokenInRange
        ? null
        : spokenParagraph < (range?.startIndex ?? 0)
          ? ("above" as const)
          : ("below" as const),
    followSpoken: () => setFollowing(true),
  };
}

/** The part of `element` the text shows in, above whatever its scroll padding leaves for. */
function viewport(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    top: box.top + (Number.parseFloat(style.scrollPaddingTop) || 0),
    bottom: box.bottom - (Number.parseFloat(style.scrollPaddingBottom) || 0),
  };
}

function positionOf(token: HTMLElement): TextPosition | null {
  const paragraph = token.closest<HTMLElement>("[data-paragraph]")?.dataset.paragraph;
  const index = token.dataset.token;
  if (paragraph === undefined || index === undefined) return null;
  return { paragraph: Number(paragraph), token: Number(index) };
}
