import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DocumentSummary } from "@/shared/api/commands.ts";
import { coverQuery } from "@/shared/api/queries.ts";

/**
 * Fills its box with the book's cover, or a title page tinted per book when it
 * has none. A `thumbnail` too small for the title is just the tint.
 */
export function DocumentCover({
  document,
  thumbnail = false,
}: {
  document: DocumentSummary;
  thumbnail?: boolean;
}) {
  const { data: url } = useQuery({ ...coverQuery(document.id), enabled: document.hasCover });

  if (url) {
    return <img src={url} alt="" draggable={false} className="size-full object-cover" />;
  }

  return (
    <div
      style={{ "--cover-hue": (document.id * 47) % 360 } as CSSProperties}
      className="flex size-full flex-col justify-between bg-[linear-gradient(160deg,oklch(0.52_0.09_var(--cover-hue)),oklch(0.3_0.06_var(--cover-hue)))] p-4 text-white"
    >
      {!thumbnail && (
        <>
          <span lang="zh" className="line-clamp-5 text-xl leading-snug font-semibold text-balance">
            {document.title}
          </span>
          <span className="truncate text-xs text-white/70">{document.fileName}</span>
        </>
      )}
    </div>
  );
}
