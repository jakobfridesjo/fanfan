import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { coverageOf, formatShare } from "@/entities/document/model/coverage.ts";

/** A thin known/learning/unseen bar without a legend, for the foot of a cover. */
export function CoverageStrip({
  document,
  className,
}: {
  document: DocumentSummary;
  className?: string;
}) {
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
      className={cn("flex h-1.5 bg-black/45", className)}
    >
      <div className="bg-success" style={{ width: `${known * 100}%` }} />
      <div className="bg-warning" style={{ width: `${learning * 100}%` }} />
    </div>
  );
}
