import type { DownloadProgress } from "@/shared/api/commands.ts";
import type { ModelDownload } from "@/shared/api/model-downloads.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatMegabytes, formatPercent } from "@/shared/lib/number-format.ts";
import { Progress } from "@/shared/ui/shadcn/progress.tsx";

/** A running download's bar, with how much of it has arrived. */
export function ModelDownloadProgress(props: {
  progress: DownloadProgress;
  /** Names the download for screen readers. */
  label: string;
}) {
  const m = useMessages();
  const percent = () => {
    const { downloaded, total } = props.progress;
    return total > 0 ? Math.min((downloaded / total) * 100, 100) : null;
  };
  return (
    <div class="flex flex-col gap-1.5">
      <Progress aria-label={props.label} value={percent()} />
      <div class="flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
        <span>
          {m.models.downloading(
            formatMegabytes(props.progress.downloaded),
            formatMegabytes(props.progress.total)
          )}
        </span>
        <span>{formatPercent(props.progress.downloaded, props.progress.total)}</span>
      </div>
    </div>
  );
}

/** Where a download stopped and why, and that trying again resumes it. */
export function ModelDownloadFailure(props: { download: ModelDownload & { state: "failed" } }) {
  const m = useMessages();
  return (
    <div
      role="alert"
      class="flex flex-col gap-0.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <p>
        {m.models.stopped(
          formatMegabytes(props.download.downloaded),
          formatMegabytes(props.download.total)
        )}{" "}
        {m.models.resumes}
      </p>
      <p class="text-xs">{props.download.error}</p>
    </div>
  );
}
