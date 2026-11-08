import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard.ts";

export type LinkLabels = Record<string, string>;

const LINK_ID_COPIED_RESET_MS = 1200;

// Show the questionnaire item's human-readable text when available (linkId
// revealed via the native hover title), or the bare linkId as a fallback. A
// copy-linkId affordance stays hidden until the row is hovered — rarely needed,
// never in the way.
export function LinkLabel({ linkId, labels }: { linkId: string; labels: LinkLabels }) {
  const text = labels[linkId];
  const { copied, copy } = useCopyToClipboard(LINK_ID_COPIED_RESET_MS);

  return (
    <span className="group/link inline-flex items-center gap-1">
      <span title={text ? linkId : undefined} className={text ? undefined : "font-mono text-xs"}>
        {text ?? linkId}
      </span>
      <button
        type="button"
        onClick={() => void copy(linkId)}
        title={`Copy linkId: ${linkId}`}
        aria-label={`Copy linkId ${linkId}`}
        className="text-muted-foreground opacity-0 transition-opacity group-hover/link:opacity-100 hover:text-foreground focus-visible:opacity-100"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
    </span>
  );
}
