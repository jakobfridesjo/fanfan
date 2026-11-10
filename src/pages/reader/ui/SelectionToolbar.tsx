import { Copy, Languages, Volume2 } from "lucide-react";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import type { Passage } from "@/pages/reader/model/use-reader-manager.ts";

/** Space between the toolbar and the text it points at. */
const GAP_PX = 6;

interface SelectionToolbarProps {
  passage: Passage;
  /** The positioned element holding the text, which the toolbar scrolls with. */
  textRef: RefObject<HTMLElement | null>;
  /** The scrolling element, to keep the toolbar from opening above its top. */
  scrollRef: RefObject<HTMLElement | null>;
  onTranslate: () => void;
  onListen: () => void;
  onCopy: () => void;
}

/**
 * What to do with a dragged-over passage, floating above it (below it near the
 * top of the view). It moves with the text, so scrolling leaves it in place.
 */
export function SelectionToolbar({
  passage,
  textRef,
  scrollRef,
  onTranslate,
  onListen,
  onCopy,
}: SelectionToolbarProps) {
  const m = useMessages();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const text = textRef.current;
    const toolbar = toolbarRef.current;
    const first = text && tokenElement(text, passage.from);
    const last = text && tokenElement(text, passage.to);
    if (!text || !toolbar || !first || !last) {
      setPosition(null);
      return;
    }
    const box = text.getBoundingClientRect();
    const start = first.getBoundingClientRect();
    const end = last.getBoundingClientRect();
    const viewTop = scrollRef.current?.getBoundingClientRect().top ?? 0;
    const height = toolbar.offsetHeight;
    const above = start.top - height - GAP_PX;
    const top = above >= viewTop ? above : end.bottom + GAP_PX;
    const left = Math.min(Math.max(start.left - box.left, 0), box.width - toolbar.offsetWidth);
    setPosition({ top: top - box.top, left: Math.max(left, 0) });
  }, [passage, textRef, scrollRef]);

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={m.reader.selection}
      className="absolute z-10 flex gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
      style={position ?? { visibility: "hidden" }}
    >
      <Button type="button" variant="ghost" size="sm" onClick={onTranslate}>
        <Languages data-icon="inline-start" />
        {m.reader.translateSelection}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onListen}>
        <Volume2 data-icon="inline-start" />
        {m.reader.listenToSelection}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
        <Copy data-icon="inline-start" />
        {m.reader.copySelection}
      </Button>
    </div>
  );
}

function tokenElement(text: HTMLElement, { paragraph, token }: Passage["from"]) {
  return text.querySelector(`[data-paragraph="${paragraph}"] [data-token="${token}"]`);
}
