import { Copy, Languages, Volume2 } from "lucide";
import { createEffect, createSignal } from "solid-js";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import type { Passage } from "@/pages/reader/model/use-reader-manager.ts";

/** Space between the toolbar and the text it points at. */
const GAP_PX = 6;

interface SelectionToolbarProps {
  passage: Passage;
  /** The positioned element holding the text, which the toolbar scrolls with. */
  text: () => HTMLElement | null | undefined;
  /** The scrolling element, to keep the toolbar from opening above its top. */
  scroller: () => HTMLElement | null | undefined;
  onTranslate: () => void;
  onListen: () => void;
  onCopy: () => void;
}

/**
 * What to do with a dragged-over passage, floating above it (below it near the
 * top of the view). It moves with the text, so scrolling leaves it in place.
 */
export function SelectionToolbar(props: SelectionToolbarProps) {
  const m = useMessages();
  let toolbar: HTMLDivElement | undefined;
  const [position, setPosition] = createSignal<{ top: number; left: number } | null>(null);

  createEffect(
    () => props.passage,
    (passage) => {
      const text = props.text();
      const first = text && tokenElement(text, passage.from);
      const last = text && tokenElement(text, passage.to);
      if (!text || !toolbar || !first || !last) {
        setPosition(null);
        return;
      }
      const box = text.getBoundingClientRect();
      const start = first.getBoundingClientRect();
      const end = last.getBoundingClientRect();
      const viewTop = props.scroller()?.getBoundingClientRect().top ?? 0;
      const height = toolbar.offsetHeight;
      const above = start.top - height - GAP_PX;
      const top = above >= viewTop ? above : end.bottom + GAP_PX;
      const left = Math.min(Math.max(start.left - box.left, 0), box.width - toolbar.offsetWidth);
      setPosition({ top: top - box.top, left: Math.max(left, 0) });
    }
  );

  const style = () => {
    const at = position();
    return at ? { top: `${at.top}px`, left: `${at.left}px` } : { visibility: "hidden" as const };
  };

  return (
    <div
      ref={(element) => (toolbar = element)}
      role="toolbar"
      aria-label={m.reader.selection}
      class="absolute z-10 flex gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
      style={style()}
    >
      <Button variant="ghost" size="sm" onClick={() => props.onTranslate()}>
        <Icon icon={Languages} data-icon="inline-start" />
        {m.reader.translateSelection}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => props.onListen()}>
        <Icon icon={Volume2} data-icon="inline-start" />
        {m.reader.listenToSelection}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => props.onCopy()}>
        <Icon icon={Copy} data-icon="inline-start" />
        {m.reader.copySelection}
      </Button>
    </div>
  );
}

function tokenElement(text: HTMLElement, { paragraph, token }: Passage["from"]) {
  return text.querySelector(`[data-paragraph="${paragraph}"] [data-token="${token}"]`);
}
