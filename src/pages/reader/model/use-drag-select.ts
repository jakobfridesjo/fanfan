import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import type { TokenPosition } from "@/pages/reader/model/use-reader-manager.ts";

/** How long a press rests on one spot before dragging selects instead of scrolling. */
const HOLD_MS = 400;
/** A press moving further than this before the hold ends is scrolling. */
const SCROLL_SLOP_PX = 8;

/** The token where a drag started and the one it is over now, in either order. */
export interface DragRange {
  anchor: TokenPosition;
  focus: TokenPosition;
}

/**
 * Selects a stretch of tokens by holding still on one, then dragging over the
 * rest, so a press that moves at once still scrolls. Each token carries
 * `data-token`, inside an element carrying `data-paragraph`.
 */
export function useDragSelect({
  onHold,
  onSelect,
}: {
  /** The hold has ended and dragging now selects. */
  onHold: () => void;
  onSelect: (range: DragRange) => void;
}) {
  const [range, setRange] = useState<DragRange | null>(null);
  /** A finished drag ends in a click on the token it stopped on, which must not select it. */
  const dragged = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const onPointerDown = (down: PointerEvent) => {
    dragged.current = false;
    if (!down.isPrimary || down.button !== 0) return;
    const anchor = tokenAt(down.target);
    if (!anchor) return;
    cleanup.current?.();
    let focus = anchor;
    let dragging = false;

    const begin = () => {
      dragging = true;
      setRange({ anchor, focus });
      onHold();
    };
    const hold = window.setTimeout(begin, HOLD_MS);

    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== down.pointerId) return;
      if (!dragging) {
        if (distance(down, event) > SCROLL_SLOP_PX) end();
        return;
      }
      const over = tokenAt(document.elementFromPoint(event.clientX, event.clientY));
      if (over && !samePosition(over, focus)) {
        focus = over;
        setRange({ anchor, focus });
      }
    };
    const up = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== down.pointerId) return;
      // A hold let go where it started is a slow tap on the word.
      const selected = dragging && !samePosition(anchor, focus);
      end();
      if (!selected) return;
      dragged.current = true;
      onSelect({ anchor, focus });
    };
    // Once the hold has ended, the finger drags the selection, not the page.
    const touchMove = (event: TouchEvent) => {
      if (dragging) event.preventDefault();
    };
    // A long press would otherwise open the webview's context menu.
    const contextMenu = (event: Event) => event.preventDefault();

    const end = () => {
      window.clearTimeout(hold);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", end);
      document.removeEventListener("touchmove", touchMove);
      document.removeEventListener("contextmenu", contextMenu);
      cleanup.current = null;
      setRange(null);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", end);
    document.addEventListener("touchmove", touchMove, { passive: false });
    document.addEventListener("contextmenu", contextMenu);
    cleanup.current = end;
  };

  const onClickCapture = (event: MouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    event.stopPropagation();
  };

  return { range, onPointerDown, onClickCapture };
}

function tokenAt(target: EventTarget | null): TokenPosition | null {
  if (!(target instanceof Element)) return null;
  const token = target.closest<HTMLElement>("[data-token]");
  const paragraph = token?.closest<HTMLElement>("[data-paragraph]");
  if (!token || !paragraph) return null;
  return { paragraph: Number(paragraph.dataset.paragraph), token: Number(token.dataset.token) };
}

function samePosition(a: TokenPosition, b: TokenPosition) {
  return a.paragraph === b.paragraph && a.token === b.token;
}

function distance(from: PointerEvent, to: globalThis.PointerEvent) {
  return Math.hypot(to.clientX - from.clientX, to.clientY - from.clientY);
}
