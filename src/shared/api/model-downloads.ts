import type { QueryClient } from "@tanstack/react-query";
import { createAtom } from "@tanstack/react-store";
import {
  commandErrorMessage,
  commands,
  type DownloadProgress,
  type Model,
} from "@/shared/api/commands.ts";
import { modelsQuery } from "@/shared/api/queries.ts";
import { currentMessages } from "@/shared/i18n/messages.ts";
import { formatMegabytes, formatPercent } from "@/shared/lib/number-format.ts";
import { dismissToast, toastError, toastLoading, toastSuccess } from "@/shared/lib/toast.ts";

export type ModelDownload =
  | ({ state: "downloading" } & DownloadProgress)
  | ({ state: "failed"; error: string } & DownloadProgress);

/**
 * Each model's running download, or the one an error stopped; absent once it finishes or is
 * cancelled. Kept outside React, so a download carries on while the person moves between pages.
 */
export const modelDownloadsAtom = createAtom<Partial<Record<Model, ModelDownload>>>({});

export interface DownloadRequest {
  model: Model;
  /** Shows the download's progress in a toast, for when nothing on screen does. */
  toast: boolean;
  /** Called once the person agrees and the download starts. */
  onAccept?: () => void;
}

/** A download waiting for the person's yes, which the app's download dialog asks for. */
export const downloadRequestAtom = createAtom<DownloadRequest | null>(null);

export function resetModelDownloads() {
  modelDownloadsAtom.set({});
  downloadRequestAtom.set(null);
}

/**
 * Whether `model` is ready to use. When it is not downloaded, asks the person to download it
 * and resolves to false. When the list of models cannot be read, lets the command try anyway.
 */
export async function ensureModel(
  queryClient: QueryClient,
  model: Model,
  request: Omit<DownloadRequest, "model">
): Promise<boolean> {
  const statuses = await queryClient.query(modelsQuery()).catch(() => null);
  const status = statuses?.find((entry) => entry.model === model);
  if (!status || status.downloaded) return true;
  if (modelDownloadsAtom.get()[model]?.state === "downloading") request.onAccept?.();
  else downloadRequestAtom.set({ model, ...request });
  return false;
}

export async function downloadModel(
  queryClient: QueryClient,
  model: Model,
  { toast = false }: { toast?: boolean } = {}
) {
  if (modelDownloadsAtom.get()[model]?.state === "downloading") return;
  const m = currentMessages();
  const toastId = `model-download-${model}`;
  const statuses = queryClient.getQueryData(modelsQuery().queryKey);
  const total = statuses?.find((entry) => entry.model === model)?.bytes ?? 0;
  const show = (progress: DownloadProgress) => {
    setDownload(model, { state: "downloading", ...progress });
    if (toast)
      toastLoading(m.models.toastDownloading[model], {
        id: toastId,
        description: `${m.models.progress(formatMegabytes(progress.downloaded), formatMegabytes(progress.total))} · ${formatPercent(progress.downloaded, progress.total)}`,
        action: { label: m.common.cancel, onClick: () => void cancelModelDownload(model) },
      });
  };
  show({ downloaded: modelDownloadsAtom.get()[model]?.downloaded ?? 0, total });
  try {
    const finished = await commands.downloadModel(model, show);
    setDownload(model, undefined);
    await queryClient.invalidateQueries({ queryKey: modelsQuery().queryKey });
    if (!toast) return;
    if (finished) toastSuccess(m.models.ready[model], { id: toastId });
    else dismissToast(toastId);
  } catch (error) {
    const progress = modelDownloadsAtom.get()[model] ?? { downloaded: 0, total };
    const message = commandErrorMessage(error, m.models.downloadFailed);
    setDownload(model, {
      state: "failed",
      downloaded: progress.downloaded,
      total: progress.total,
      error: message,
    });
    if (toast)
      toastError(
        m.models.stopped(formatMegabytes(progress.downloaded), formatMegabytes(progress.total)),
        {
          id: toastId,
          description: message,
          action: {
            label: m.common.tryAgain,
            onClick: () => void downloadModel(queryClient, model, { toast }),
          },
        }
      );
  }
}

/** The download stops at its next chunk; what arrived stays for next time. */
export function cancelModelDownload(model: Model) {
  return commands.cancelModelDownload(model);
}

function setDownload(model: Model, download: ModelDownload | undefined) {
  modelDownloadsAtom.set((all) => {
    const next = { ...all };
    if (download) next[model] = download;
    else delete next[model];
    return next;
  });
}
