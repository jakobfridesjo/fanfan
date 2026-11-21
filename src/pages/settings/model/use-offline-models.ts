import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createSignal } from "solid-js";
import { commandErrorMessage, commands, type Model } from "@/shared/api/commands.ts";
import {
  cancelModelDownload,
  downloadModel,
  modelDownloadsAtom,
} from "@/shared/api/model-downloads.ts";
import { modelsQuery, useCommandQuery } from "@/shared/api/queries.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";

const modelToast = actionToasts("offline-models");

/** The downloadable models: which are on this device, running downloads, and deleting one. */
export function useOfflineModels() {
  const m = useMessages();
  const queryClient = useQueryClient();
  const models = useCommandQuery(() => modelsQuery());
  /** The model whose deletion waits for confirmation. */
  const [deleting, setDeleting] = createSignal<Model | null>(null);

  const deleteMutation = useMutation(() => ({
    mutationFn: commands.deleteModel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modelsQuery().queryKey }),
    onError: (error: Error) => modelToast.error(commandErrorMessage(error, m.models.deleteFailed)),
    onSettled: () => void setDeleting(null),
  }));

  return {
    get models() {
      return models.data ?? [];
    },
    get downloads() {
      return modelDownloadsAtom();
    },
    download: (model: Model) => void downloadModel(queryClient, model),
    cancel: (model: Model) => void cancelModelDownload(model),
    get deleting() {
      const model = deleting();
      return (model && models.data?.find((entry) => entry.model === model)) || null;
    },
    askToDelete: (model: Model) => void setDeleting(model),
    closeDelete: () => void setDeleting(null),
    confirmDelete: () => {
      const model = deleting();
      if (model) void deleteMutation.mutate(model);
    },
    get deletePending() {
      return deleteMutation.isPending;
    },
  };
}
