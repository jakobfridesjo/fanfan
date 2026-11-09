import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

export interface DropTarget {
  kind: "document" | "folder";
  id: number;
}

export interface ShelfDrag {
  documentId: number;
  offset: { x: number; y: number };
  over: DropTarget | null;
}

/** How far the pointer travels before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 6;
/** How long a finger rests on a book before it lifts to be dragged; moving sooner scrolls the shelf. */
const TOUCH_HOLD_MS = 500;

/** Marks an element as somewhere a dragged book can land. */
export function dropTargetProps(target: DropTarget) {
  return { "data-drop-kind": target.kind, "data-drop-id": target.id };
}

function dropTargetAt(x: number, y: number, draggedId: number): DropTarget | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-kind]");
  if (!element) return null;
  const kind = element.dataset.dropKind as DropTarget["kind"];
  const id = Number(element.dataset.dropId);
  return kind === "document" && id === draggedId ? null : { kind, id };
}

/**
 * Drags a book across the shelf with the pointer, and calls `onDrop` when it is
 * released over another book or a folder. A finger lifts the book by holding
 * still on it, so a swipe scrolls the shelf instead. Escape cancels. The dragged
 * element must ignore the pointer while dragging, so what lies beneath it can be found.
 */
export function useShelfDrag(onDrop: (documentId: number, target: DropTarget) => void) {
  const [drag, setDrag] = useState<ShelfDrag | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const swallowClick = useRef(false);

  useEffect(() => () => cleanup.current?.(), []);

  const swallowNextClick = () => {
    swallowClick.current = true;
    setTimeout(() => (swallowClick.current = false));
  };

  const dragHandlers = (documentId: number) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !event.isPrimary) return;
      cleanup.current?.();
      const start = { x: event.clientX, y: event.clientY };
      const touch = event.pointerType === "touch";
      let held = !touch;
      let dragging = false;
      const hold = touch
        ? setTimeout(() => {
            held = true;
            dragging = true;
            setDrag({ documentId, offset: { x: 0, y: 0 }, over: null });
          }, TOUCH_HOLD_MS)
        : undefined;

      const move = (moved: PointerEvent) => {
        const offset = { x: moved.clientX - start.x, y: moved.clientY - start.y };
        if (!dragging && Math.hypot(offset.x, offset.y) < DRAG_THRESHOLD) return;
        if (!held) {
          cleanup.current?.();
          return;
        }
        dragging = true;
        setDrag({
          documentId,
          offset,
          over: dropTargetAt(moved.clientX, moved.clientY, documentId),
        });
      };
      const finish = (target: DropTarget | null) => {
        cleanup.current?.();
        // The release still clicks the book; after a drag it must not open it.
        if (dragging) swallowNextClick();
        if (!dragging) return;
        setDrag(null);
        if (target) onDrop(documentId, target);
      };
      const release = (released: PointerEvent) =>
        finish(dropTargetAt(released.clientX, released.clientY, documentId));
      const cancel = () => finish(null);
      const escape = (key: KeyboardEvent) => {
        if (key.key === "Escape") cancel();
      };

      // Once a finger has held, its moves drag the book rather than scroll the shelf.
      const holdScroll = (moved: TouchEvent) => {
        if (held) moved.preventDefault();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("touchmove", holdScroll, { passive: false });
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", escape);
      cleanup.current = () => {
        clearTimeout(hold);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("touchmove", holdScroll);
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", escape);
        cleanup.current = null;
      };
    },
    // A long press moves the book; it must not also open the webview's menu.
    onContextMenu: (event: ReactMouseEvent) => event.preventDefault(),
    onClickCapture: (event: ReactMouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  });

  return { drag, dragHandlers };
}

export type DragHandlers = ReturnType<ReturnType<typeof useShelfDrag>["dragHandlers"]>;
