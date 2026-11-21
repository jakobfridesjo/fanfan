import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { coverageOf, formatShare } from "@/entities/document/model/coverage.ts";

const TRACKS = {
  bar: "h-2 rounded-full bg-foreground/10",
  /** Thin, for the foot of a cover. */
  strip: "h-1.5 bg-black/45",
};

/** How much of the document's text is known, and how much is being learned. */
export function CoverageBar(props: {
  document: DocumentSummary;
  variant?: keyof typeof TRACKS;
  class?: string;
}) {
  const m = useMessages();
  const coverage = () => coverageOf(props.document);

  return (
    <div
      role="meter"
      aria-label={m.coverage.meter}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(coverage().known * 100)}
      aria-valuetext={`${m.coverage.known(formatShare(coverage().known))}, ${m.coverage.learning(formatShare(coverage().learning))}`}
      class={cn("flex overflow-hidden", TRACKS[props.variant ?? "bar"], props.class)}
    >
      <div class="bg-success" style={{ width: `${coverage().known * 100}%` }} />
      <div class="bg-warning" style={{ width: `${coverage().learning * 100}%` }} />
    </div>
  );
}
