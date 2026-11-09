import { useEffect, useLayoutEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/** A first guess at a paragraph's height in pixels, before it is measured. */
const ESTIMATED_PARAGRAPH_HEIGHT = 96;

interface SectionScrollOptions {
  paragraphCount: number;
  /** Scrolled to on mount; later changes are ignored. */
  initialParagraph: number;
  onParagraphReached: (paragraph: number) => void;
  /** The paragraph being read aloud, kept in view. */
  spokenParagraph: number | undefined;
}

/** Virtualizes a section's paragraphs, restores the reading position and follows read-aloud. */
export function useSectionScroll({
  paragraphCount,
  initialParagraph,
  onParagraphReached,
  spokenParagraph,
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

  useEffect(() => {
    if (spokenParagraph !== undefined)
      virtualizer.scrollToIndex(spokenParagraph, { align: "auto" });
  }, [virtualizer, spokenParagraph]);

  return {
    scrollRef,
    measureElement: virtualizer.measureElement,
    items: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}
