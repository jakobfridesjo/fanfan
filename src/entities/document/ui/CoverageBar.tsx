import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { coverageOf, formatShare } from "@/entities/document/model/coverage.ts";

/** How much of the document's text is known, and how much is being learned. */
export function CoverageBar({ document }: { document: DocumentSummary }) {
  const m = useMessages();
  const { known, learning } = coverageOf(document);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="meter"
        aria-label={m.coverage.meter}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(known * 100)}
        aria-valuetext={`${m.coverage.known(formatShare(known))}, ${m.coverage.learning(formatShare(learning))}`}
        className="flex h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="bg-success" style={{ width: `${known * 100}%` }} />
        <div className="bg-warning" style={{ width: `${learning * 100}%` }} />
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          {m.coverage.known(formatShare(known))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" />
          {m.coverage.learning(formatShare(learning))}
        </span>
      </div>
    </div>
  );
}
