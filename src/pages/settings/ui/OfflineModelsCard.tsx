import { Check, Download, Languages, Volume2 } from "lucide-react";
import type { ModelStatus } from "@/shared/api/commands.ts";
import type { ModelDownload } from "@/shared/api/model-downloads.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatMegabytes } from "@/shared/lib/number-format.ts";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";
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
    <Card className="w-full max-w-2xl shrink-0">
      <CardHeader>
        <CardTitle>{m.models.title}</CardTitle>
        <CardDescription>{m.models.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {offline.models.map((status) => (
          <ModelRow
            key={status.model}
            status={status}
            download={offline.downloads[status.model]}
            onDownload={() => offline.download(status.model)}
            onCancel={() => offline.cancel(status.model)}
            onDelete={() => offline.askToDelete(status.model)}
          />
        ))}
        <p className="text-sm text-muted-foreground">{m.models.hint}</p>
      </CardContent>
      {offline.deleting && (
        <ConfirmationDialog
          open
          onClose={offline.closeDelete}
          onConfirm={offline.confirmDelete}
          title={m.models.deleteTitle[offline.deleting.model]}
          message={m.models.deleteMessage(formatMegabytes(offline.deleting.bytes))}
          confirmLabel={m.common.delete}
          destructive
          loading={offline.deletePending}
        />
      )}
    </Card>
  );
}

function ModelRow({
  status,
  download,
  onDownload,
  onCancel,
  onDelete,
}: {
  status: ModelStatus;
  download: ModelDownload | undefined;
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const m = useMessages();
  const { model } = status;
  const Icon = ICONS[model];
  const name = m.models.names[model];

  return (
    <section aria-label={name} className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-text">
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{name}</span>
          <span className="text-sm text-muted-foreground">
            {m.models.sources[model]} · {formatMegabytes(status.bytes)}
          </span>
          {status.downloaded ? (
            <span className="mt-1 flex items-center gap-1 text-sm text-success">
              <Check className="size-3.5" aria-hidden />
              {m.models.downloaded}
            </span>
          ) : (
            !download && (
              <span className="mt-1 text-sm text-muted-foreground">{m.models.uses[model]}</span>
            )
          )}
        </div>
        {status.downloaded ? (
          <Button type="button" variant="outline" size="sm" onClick={onDelete}>
            {m.common.delete}
          </Button>
        ) : download?.state === "downloading" ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {m.common.cancel}
          </Button>
        ) : download?.state === "failed" ? (
          <Button type="button" variant="outline" size="sm" onClick={onDownload}>
            {m.common.tryAgain}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={onDownload}>
            <Download data-icon="inline-start" />
            {m.models.download}
          </Button>
        )}
      </div>
      {!status.downloaded && download?.state === "downloading" && (
        <ModelDownloadProgress progress={download} label={name} />
      )}
      {!status.downloaded && download?.state === "failed" && (
        <ModelDownloadFailure download={download} />
      )}
    </section>
  );
}
