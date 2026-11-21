import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { Languages, Volume2 } from "lucide";
import { Show } from "solid-js";
import { downloadModel, downloadRequestAtom } from "@/shared/api/model-downloads.ts";
import { modelsQuery } from "@/shared/api/queries.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatMegabytes } from "@/shared/lib/number-format.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
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
  const models = useQuery(() => ({ ...modelsQuery(), enabled: downloadRequestAtom() !== null }));
  const close = () => downloadRequestAtom.set(null);

  return (
    <Show when={downloadRequestAtom()}>
      {(request) => {
        const bytes = () =>
          (models.isSuccess ? models.data : undefined)?.find(
            (entry) => entry.model === request().model
          )?.bytes ?? 0;
        const accept = () => {
          const accepted = request();
          close();
          void downloadModel(queryClient, accepted.model, { toast: accepted.toast });
          accepted.onAccept?.();
        };
        return (
          <Dialog open onClose={close}>
            <DialogContent>
              <DialogHeader>
                <div class="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
                  <Icon icon={request().model === "voice" ? Volume2 : Languages} class="size-6" />
                </div>
                <DialogTitle>{m.models.promptTitle[request().model]}</DialogTitle>
                <DialogDescription>
                  {m.models.promptDescription[request().model](formatMegabytes(bytes()))}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter class="grid grid-cols-2 sm:flex">
                <Button variant="outline" onClick={close}>
                  {m.common.cancel}
                </Button>
                <Button onClick={accept}>{m.models.download}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      }}
    </Show>
  );
}
