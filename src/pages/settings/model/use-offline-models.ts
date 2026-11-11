import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { commandErrorMessage, commands, type Model } from "@/shared/api/commands.ts";
import {
  cancelModelDownload,
  downloadModel,
  modelDownloadsAtom,
} from "@/shared/api/model-downloads.ts";
import { modelsQuery } from "@/shared/api/queries.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";

const modelToast = actionToasts("offline-models");

/** The downloadable models: which are on this device, running downloads, and deleting one. */
export function useOfflineModels() {
  const m = useMessages();
  const queryClient = useQueryClient();
  const models = useQuery(modelsQuery());
  const downloads = useSelector(modelDownloadsAtom);
  /** The model whose deletion waits for confirmation. */
  const [deleting, setDeleting] = useState<Model | null>(null);

  const deleteMutation = useMutation({
    mutationFn: commands.deleteModel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modelsQuery().queryKey }),
    onError: (error) => modelToast.error(commandErrorMessage(error, m.models.deleteFailed)),
    onSettled: () => setDeleting(null),
  });

  return {
    models: models.data ?? [],
    downloads,
    download: (model: Model) => void downloadModel(queryClient, model),
    cancel: (model: Model) => void cancelModelDownload(model),
    deleting: deleting && models.data?.find((entry) => entry.model === deleting),
    askToDelete: setDeleting,
    closeDelete: () => setDeleting(null),
    confirmDelete: () => {
      if (deleting) deleteMutation.mutate(deleting);
    },
    deletePending: deleteMutation.isPending,
  };
}
