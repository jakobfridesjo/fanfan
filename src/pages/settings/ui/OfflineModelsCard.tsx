import { For, Match, Show, Switch } from "solid-js";
import { Check, Download, Languages, Volume2 } from "lucide";
import type { ModelStatus } from "@/shared/api/commands.ts";
import type { ModelDownload } from "@/shared/api/model-downloads.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatMegabytes } from "@/shared/lib/number-format.ts";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";
import { ModelDownloadFailure, ModelDownloadProgress } from "@/shared/ui/ModelDownloadProgress.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/shadcn/card.tsx";
import { useOfflineModels } from "@/pages/settings/model/use-offline-models.ts";

const ICONS = { voice: Volume2, translator: Languages } as const;

export function OfflineModelsCard() {
  const m = useMessages();
  const offline = useOfflineModels();

  return (
    <Card class="w-full max-w-2xl shrink-0">
      <CardHeader>
        <CardTitle>{m.models.title}</CardTitle>
        <CardDescription>{m.models.description}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <For each={offline.models} keyed={(status) => status.model}>
          {(status) => (
            <ModelRow
              status={status()}
              download={offline.downloads[status().model]}
              onDownload={() => offline.download(status().model)}
              onCancel={() => offline.cancel(status().model)}
              onDelete={() => offline.askToDelete(status().model)}
            />
          )}
        </For>
        <p class="text-sm text-muted-foreground">{m.models.hint}</p>
      </CardContent>
      <Show when={offline.deleting}>
        {(deleting) => (
          <ConfirmationDialog
            open
            onClose={offline.closeDelete}
            onConfirm={offline.confirmDelete}
            title={m.models.deleteTitle[deleting().model]}
            message={m.models.deleteMessage(formatMegabytes(deleting().bytes))}
            confirmLabel={m.common.delete}
            destructive
            loading={offline.deletePending}
          />
        )}
      </Show>
    </Card>
  );
}

function ModelRow(props: {
  status: ModelStatus;
  download: ModelDownload | undefined;
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const m = useMessages();
  const model = () => props.status.model;
  const name = () => m.models.names[model()];
  const downloading = () => {
    const download = props.download;
    return !props.status.downloaded && download?.state === "downloading" ? download : undefined;
  };
  const failed = () => {
    const download = props.download;
    return !props.status.downloaded && download?.state === "failed" ? download : undefined;
  };

  return (
    <section aria-label={name()} class="flex flex-col gap-3 rounded-lg border p-3">
      <div class="flex items-start gap-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-text">
          <Show when={ICONS[model()]} keyed>
            {(icon) => <Icon icon={icon} class="size-4" />}
          </Show>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="font-medium">{name()}</span>
          <span class="text-sm text-muted-foreground">
            {m.models.sources[model()]} · {formatMegabytes(props.status.bytes)}
          </span>
          <Switch>
            <Match when={props.status.downloaded}>
              <span class="mt-1 flex items-center gap-1 text-sm text-success">
                <Icon icon={Check} class="size-3.5" />
                {m.models.downloaded}
              </span>
            </Match>
            <Match when={!props.download}>
              <span class="mt-1 text-sm text-muted-foreground">{m.models.uses[model()]}</span>
            </Match>
          </Switch>
        </div>
        <Switch
          fallback={
            <Button size="sm" onClick={() => props.onDownload()}>
              <Icon icon={Download} data-icon="inline-start" />
              {m.models.download}
            </Button>
          }
        >
          <Match when={props.status.downloaded}>
            <Button variant="outline" size="sm" onClick={() => props.onDelete()}>
              {m.common.delete}
            </Button>
          </Match>
          <Match when={downloading()}>
            <Button variant="outline" size="sm" onClick={() => props.onCancel()}>
              {m.common.cancel}
            </Button>
          </Match>
          <Match when={failed()}>
            <Button variant="outline" size="sm" onClick={() => props.onDownload()}>
              {m.common.tryAgain}
            </Button>
          </Match>
        </Switch>
      </div>
      <Show when={downloading()}>
        {(download) => <ModelDownloadProgress progress={download()} label={name()} />}
      </Show>
      <Show when={failed()}>{(download) => <ModelDownloadFailure download={download()} />}</Show>
    </section>
  );
}
