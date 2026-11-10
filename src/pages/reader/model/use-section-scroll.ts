import {
  type RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { elementScroll, useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";

/** A first guess at a paragraph's height in pixels, before it is measured. */
const ESTIMATED_PARAGRAPH_HEIGHT = 96;

/**
 * Where in the view, as fractions of its height, the spoken phrase may start before the text
 * glides it back to `rest`, just above the middle so the phrase's lines read around the middle:
 * a little drift between moves keeps the text from crawling.
 */
const SPOKEN_BAND = { top: 0.2, rest: 0.35, bottom: 0.45 };

/** How long a smooth scroll glides, in milliseconds: longer for a longer way, within bounds. */
const glideDuration = (distance: number) => Math.min(700, 250 + Math.abs(distance) * 0.6);

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

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
  const [glide] = useState(createGlide);
  // oxlint-disable-next-line react/incompatible-library -- "use no memo" above, and callers get only fresh values and the stable measureElement
  const virtualizer = useVirtualizer({
    count: paragraphCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_PARAGRAPH_HEIGHT,
    overscan: 6,
    scrollToFn: glide.scrollToFn,
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
    // The reader's own touch, wheel or key takes over from a glide under way.
    const takeOver = () => glide.stop();
    const inputs = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    element.addEventListener("scroll", onScroll, { passive: true });
    for (const input of inputs) element.addEventListener(input, takeOver, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      for (const input of inputs) element.removeEventListener(input, takeOver);
      glide.stop();
    };
  }, [virtualizer, glide]);

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
      virtualizer.scrollBy(at - height * SPOKEN_BAND.rest, {
        behavior: smooth ? "smooth" : "auto",
      });
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

/**
 * A `scrollToFn` that animates smooth scrolls itself, frame by frame, instead of leaving them to
 * the webview: WebKitGTK may jump where Android's WebView glides.
 */
function createGlide() {
  let frame = 0;
  const stop = () => cancelAnimationFrame(frame);
  const scrollToFn = (
    offset: number,
    options: { adjustments?: number; behavior?: ScrollBehavior },
    instance: Virtualizer<HTMLDivElement, Element>
  ) => {
    stop();
    const element = instance.scrollElement;
    if (options.behavior !== "smooth" || !element) {
      elementScroll(offset, options, instance);
      return;
    }
    const from = element.scrollTop;
    const to = offset + (options.adjustments ?? 0);
    const duration = glideDuration(to - from);
    const started = performance.now();
    let written = from;
    const step = (now: number) => {
      // Something else moved the text, such as the reader dragging the scrollbar: let it be.
      if (Math.abs(element.scrollTop - written) > 2) return;
      const progress = Math.min(1, (now - started) / duration);
      element.scrollTop = from + (to - from) * easeInOutCubic(progress);
      written = element.scrollTop;
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
  return { scrollToFn, stop };
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
