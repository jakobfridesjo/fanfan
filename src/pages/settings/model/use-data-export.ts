import { useMutation } from "@tanstack/solid-query";
import { save } from "@tauri-apps/plugin-dialog";
import { commandErrorMessage, commands } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { toLocalDateString } from "@/shared/lib/date.ts";
import { actionToasts } from "@/shared/lib/toast.ts";

const exportToast = actionToasts("data-export");

/** Saves a JSON backup wherever the learner picks. */
export function useDataExport() {
  const m = useMessages();

  const exportMutation = useMutation(() => ({
    mutationFn: async () => {
      const path = await save({
        defaultPath: `fanfan-backup-${toLocalDateString(new Date())}.json`,
        filters: [{ name: m.settings.exportFilter, extensions: ["json"] }],
      });
      if (path === null) return false;
      await commands.exportData(path);
      return true;
    },
    onSuccess: (saved: boolean) => {
      if (saved) exportToast.success(m.settings.exported);
    },
    onError: (error: Error) =>
      exportToast.error(commandErrorMessage(error, m.settings.exportFailed)),
  }));

  return {
    exportData: () => void exportMutation.mutate(),
    get exporting() {
      return exportMutation.isPending;
    },
  };
}
