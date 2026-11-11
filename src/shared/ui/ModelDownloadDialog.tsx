import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { Languages, Volume2 } from "lucide-react";
import { downloadModel, downloadRequestAtom } from "@/shared/api/model-downloads.ts";
import { modelsQuery } from "@/shared/api/queries.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatMegabytes } from "@/shared/lib/number-format.ts";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog.tsx";

/** Asks before downloading a model that Listen or Translate needs, wherever they were pressed. */
export function ModelDownloadDialog() {
  const m = useMessages();
  const queryClient = useQueryClient();
  const request = useSelector(downloadRequestAtom);
  const models = useQuery({ ...modelsQuery(), enabled: request !== null });
  if (!request) return null;

  const { model } = request;
  const bytes = models.data?.find((entry) => entry.model === model)?.bytes ?? 0;
  const close = () => downloadRequestAtom.set(null);
  const accept = () => {
    close();
    void downloadModel(queryClient, model, { toast: request.toast });
    request.onAccept?.();
  };
  const Icon = model === "voice" ? Volume2 : Languages;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
            <Icon aria-hidden />
          </div>
          <DialogTitle>{m.models.promptTitle[model]}</DialogTitle>
          <DialogDescription>
            {m.models.promptDescription[model](formatMegabytes(bytes))}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2 sm:flex">
          <Button type="button" variant="outline" onClick={close}>
            {m.common.cancel}
          </Button>
          <Button type="button" onClick={accept}>
            {m.models.download}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
