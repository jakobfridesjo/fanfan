import { Show } from "solid-js";
import type { DocumentSummary } from "@/shared/api/commands.ts";
import { coverQuery, useCommandQuery } from "@/shared/api/queries.ts";

/**
 * Fills its box with the book's cover, or a title page tinted per book when it
 * has none. A `thumbnail` too small for the title is just the tint.
 */
export function DocumentCover(props: { document: DocumentSummary; thumbnail?: boolean }) {
  const cover = useCommandQuery(() => ({
    ...coverQuery(props.document.id),
    enabled: props.document.hasCover,
  }));

  return (
    <Show
      when={cover.data}
      fallback={
        <div
          style={{ "--cover-hue": (props.document.id * 47) % 360 }}
          class="flex size-full flex-col justify-between bg-[linear-gradient(160deg,oklch(0.52_0.09_var(--cover-hue)),oklch(0.3_0.06_var(--cover-hue)))] p-4 text-white"
        >
          <Show when={!props.thumbnail}>
            <span lang="zh" class="line-clamp-5 text-xl leading-snug font-semibold text-balance">
              {props.document.title}
            </span>
            <span class="truncate text-xs text-white/70">{props.document.fileName}</span>
          </Show>
        </div>
      }
    >
      {(url) => <img src={url()} alt="" draggable={false} class="size-full object-cover" />}
    </Show>
  );
}
