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
export function ImportProgressDialog({ progress }: { progress: ImportProgress }) {
  const m = useMessages();
  return (
    <Dialog open disablePointerDismissal>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{m.library.importTitle}</DialogTitle>
          {progress.fileName && (
            <DialogDescription lang="zh" className="truncate">
              {progress.fileName}
            </DialogDescription>
          )}
        </DialogHeader>
        <Progress value={importPercent(progress.stage)} locale={appLocale()}>
          <ProgressLabel>{m.library.stages[progress.stage?.stage ?? "dictionary"]}</ProgressLabel>
          <ProgressValue />
        </Progress>
      </DialogContent>
    </Dialog>
  );
}
