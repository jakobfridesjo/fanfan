import { createEffect, createMemo, createSignal, onSettled, untrack } from "solid-js";
import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  Virtualizer,
} from "@tanstack/virtual-core";

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
  paragraphCount: () => number;
  /** Scrolled to once the text is on the page; later changes are ignored. */
  initialParagraph: number;
  onParagraphReached: (paragraph: number) => void;
  /** The paragraph being read aloud, kept in view until the reader scrolls it away. */
  spokenParagraph: () => number | undefined;
  /** The token the spoken phrase starts at. */
  spokenToken: () => number | undefined;
  /** Given the text on screen, and null once it is gone. */
  onView: (view: TextView | null) => void;
}

/** Virtualizes a section's paragraphs, restores the reading position and follows read-aloud. */
export function useSectionScroll(options: SectionScrollOptions) {
  let scrollElement: HTMLDivElement | null = null;
  const glide = createGlide();
  const [version, setVersion] = createSignal(0, { ownedWrite: true });
  const virtualizerOptions = (count: number) => ({
    count,
    getScrollElement: () => scrollElement,
    estimateSize: () => ESTIMATED_PARAGRAPH_HEIGHT,
    overscan: 6,
    observeElementRect,
    observeElementOffset,
    scrollToFn: glide.scrollToFn,
    onChange: (instance: Virtualizer<HTMLDivElement, Element>) => {
      setVersion((count) => count + 1);
      const first = instance.range?.startIndex;
      if (first !== undefined) options.onParagraphReached(first);
    },
  });
  const paragraphCount = createMemo(options.paragraphCount);
  const virtualizer = new Virtualizer<HTMLDivElement, Element>(
    virtualizerOptions(untrack(paragraphCount))
  );
  createEffect(
    paragraphCount,
    (count) => {
      virtualizer.setOptions(virtualizerOptions(count));
      virtualizer._willUpdate();
      setVersion((current) => current + 1);
    },
    { defer: true }
  );

  /** Whether read-aloud scrolls the text along; scrolling the spoken paragraph away stops it. */
  const [following, setFollowing] = createSignal(true);
  const spokenParagraph = createMemo(options.spokenParagraph);
  const spokenToken = createMemo(options.spokenToken);
  const range = () => {
    version();
    return virtualizer.range;
  };
  const spokenInRange = createMemo(() => {
    const spoken = spokenParagraph();
    const shown = range();
    return (
      spoken !== undefined &&
      shown !== null &&
      spoken >= shown.startIndex &&
      spoken <= shown.endIndex
    );
  });
  // Reading stopped, or reached the text the reader scrolled to: follow it again.
  const followAgain = createMemo(
    () => !following() && (spokenParagraph() === undefined || spokenInRange())
  );
  createEffect(followAgain, (again) => {
    if (again) setFollowing(true);
  });

  onSettled(() => {
    const element = scrollElement;
    if (!element) return;
    const unmount = virtualizer._didMount();
    virtualizer._willUpdate();
    if (options.initialParagraph > 0)
      virtualizer.scrollToIndex(options.initialParagraph, { align: "start" });

    options.onView({
      firstToken: () => {
        const { top, bottom } = viewport(element);
        for (const token of element.querySelectorAll<HTMLElement>("[data-token]")) {
          const box = token.getBoundingClientRect();
          if (box.top >= top && box.top < bottom) return positionOf(token);
        }
        return null;
      },
      shows: ({ paragraph, token }) => {
        const target = element.querySelector(
          `[data-paragraph="${paragraph}"] [data-token="${token}"]`
        );
        if (!target) return false;
        const { top, bottom } = viewport(element);
        const box = target.getBoundingClientRect();
        return box.bottom > top && box.top < bottom;
      },
    });

    // Read-aloud's own scrolling lands on the spoken paragraph, so only the reader scrolls it away.
    const onScroll = () => {
      const spoken = spokenParagraph();
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
      options.onView(null);
      unmount();
    };
  });

  createEffect(
    () => ({ follows: following(), paragraph: spokenParagraph(), token: spokenToken() }),
    ({ follows, paragraph, token: spokenAt }) => {
      const element = scrollElement;
      if (!element || !follows || paragraph === undefined || spokenAt === undefined) return;
      let frame = 0;
      const center = (rendered: boolean) => {
        const token = element.querySelector(
          `[data-paragraph="${paragraph}"] [data-token="${spokenAt}"]`
        );
        if (!token) {
          // Not rendered yet: bring its paragraph in, then place the phrase once it is.
          if (rendered) return;
          virtualizer.scrollToIndex(paragraph, { align: "center" });
          frame = requestAnimationFrame(() => center(true));
          return;
        }
        const { top, bottom } = viewport(element);
        const height = bottom - top;
        const at = token.getBoundingClientRect().top - top;
        if (at >= height * SPOKEN_BAND.top && at <= height * SPOKEN_BAND.bottom) return;
        const to = element.scrollTop + at - height * SPOKEN_BAND.rest;
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) element.scrollTop = to;
        else glide.to(element, to);
      };
      center(false);
      return () => cancelAnimationFrame(frame);
    }
  );

  return {
    scrollRef: (element: HTMLDivElement) => {
      scrollElement = element;
    },
    scrollElement: () => scrollElement,
    measure: (element: Element) => {
      queueMicrotask(() => virtualizer.measureElement(element));
    },
    get items() {
      version();
      paragraphCount();
      return virtualizer.getVirtualItems();
    },
    get totalSize() {
      version();
      paragraphCount();
      return virtualizer.getTotalSize();
    },
    /** Where the spoken paragraph lies once the reader scrolled away from it. */
    get spokenOutOfView() {
      const spoken = spokenParagraph();
      if (following() || spoken === undefined || spokenInRange()) return null;
      return spoken < (range()?.startIndex ?? 0) ? ("above" as const) : ("below" as const);
    },
    followSpoken: () => setFollowing(true),
  };
}

/**
 * Glides the text frame by frame instead of leaving smooth scrolls to the webview, which on
 * WebKitGTK may jump. It goes around the virtualizer: while that runs a smooth scroll of its own
 * it stops measuring paragraphs away from the target, which then overlap at their estimated
 * heights. Its `scrollToFn` carries a glide along when a paragraph above resizes.
 */
function createGlide() {
  let frame = 0;
  let glide: { from: number; to: number; written: number } | null = null;
  const stop = () => {
    cancelAnimationFrame(frame);
    glide = null;
  };
  const to = (element: HTMLElement, target: number) => {
    stop();
    const from = element.scrollTop;
    const duration = glideDuration(target - from);
    const started = performance.now();
    const current = { from, to: target, written: from };
    glide = current;
    const step = (now: number) => {
      // Something else moved the text, such as the reader dragging the scrollbar: let it be.
      if (Math.abs(element.scrollTop - current.written) > 2) {
        glide = null;
        return;
      }
      const progress = Math.min(1, (now - started) / duration);
      element.scrollTop = current.from + (current.to - current.from) * easeInOutCubic(progress);
      current.written = element.scrollTop;
      if (progress < 1) frame = requestAnimationFrame(step);
      else glide = null;
    };
    frame = requestAnimationFrame(step);
  };
  const scrollToFn = (
    offset: number,
    options: { adjustments?: number; behavior?: ScrollBehavior },
    instance: Virtualizer<HTMLDivElement, Element>
  ) => {
    const shift = options.adjustments ?? 0;
    if (glide && shift !== 0) {
      glide.from += shift;
      glide.to += shift;
      glide.written += shift;
      // The virtualizer's offset may lag the glide by a frame: shift what the glide last wrote.
      if (instance.scrollElement) instance.scrollElement.scrollTop = glide.written;
      return;
    }
    stop();
    elementScroll(offset, options, instance);
  };
  return { to, scrollToFn, stop };
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
