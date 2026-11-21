import { Show } from "solid-js";
import { useMessages } from "@/shared/i18n/messages.ts";
import { appLocale } from "@/shared/lib/locale.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog.tsx";
import { Progress, ProgressLabel, ProgressValue } from "@/shared/ui/shadcn/progress.tsx";
import { importPercent, type ImportProgress } from "@/pages/library/model/use-library-manager.ts";

/** Holds the screen while a book imports: it cannot be dismissed, only finished. */
export function ImportProgressDialog(props: { progress: ImportProgress }) {
  const m = useMessages();
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.library.importTitle}</DialogTitle>
          <Show when={props.progress.fileName}>
            <DialogDescription lang="zh" class="truncate">
              {props.progress.fileName}
            </DialogDescription>
          </Show>
        </DialogHeader>
        <Progress
          value={importPercent(props.progress.stage)}
          formatValue={(percent) =>
            (percent / 100).toLocaleString(appLocale(), {
              style: "percent",
              maximumFractionDigits: 0,
            })
          }
        >
          <ProgressLabel>
            {m.library.stages[props.progress.stage?.stage ?? "dictionary"]}
          </ProgressLabel>
          <ProgressValue />
        </Progress>
      </DialogContent>
    </Dialog>
  );
}
