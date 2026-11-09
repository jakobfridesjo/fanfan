import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { coverageOf, formatShare } from "@/entities/document/model/coverage.ts";

/** How much of the document's text is known, and how much is being learned. */
export function CoverageBar({ document }: { document: DocumentSummary }) {
  const m = useMessages();
  const { known, learning } = coverageOf(document);

  return (
    <div
      role="meter"
      aria-label={m.coverage.meter}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(known * 100)}
      aria-valuetext={`${m.coverage.known(formatShare(known))}, ${m.coverage.learning(formatShare(learning))}`}
      className="flex h-2 overflow-hidden rounded-full bg-foreground/10"
    >
      <div className="bg-success" style={{ width: `${known * 100}%` }} />
      <div className="bg-warning" style={{ width: `${learning * 100}%` }} />
    </div>
  );
}
