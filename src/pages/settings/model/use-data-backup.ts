import { useMutation } from "@tanstack/solid-query";
import { open, save } from "@tauri-apps/plugin-dialog";
import { type BackupImport, commandErrorMessage, commands } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { toLocalDateString } from "@/shared/lib/date.ts";
import { actionToasts } from "@/shared/lib/toast.ts";

const backupToast = actionToasts("data-backup");

/** Saves a JSON backup wherever the learner picks, and merges one back in. */
export function useDataBackup() {
  const m = useMessages();
  const filters = () => [{ name: m.settings.exportFilter, extensions: ["json"] }];

  const exportMutation = useMutation(() => ({
    mutationFn: async () => {
      const path = await save({
        defaultPath: `fanfan-backup-${toLocalDateString(new Date())}.json`,
        filters: filters(),
      });
      if (path === null) return false;
      await commands.exportData(path);
      return true;
    },
    onSuccess: (saved: boolean) => {
      if (saved) backupToast.success(m.settings.exported);
    },
    onError: (error: Error) =>
      backupToast.error(commandErrorMessage(error, m.settings.exportFailed)),
  }));

  const importMutation = useMutation(() => ({
    mutationFn: async () => {
      const path = await open({ multiple: false, directory: false, filters: filters() });
      return path === null ? null : commands.importData(path);
    },
    meta: { changesStudyData: true as const },
    onSuccess: (imported: BackupImport | null) => {
      if (imported === null) return;
      const description =
        imported.missingDocuments > 0
          ? m.settings.missingBooks(imported.missingDocuments)
          : undefined;
      if (imported.words === 0 && imported.reviews === 0) {
        backupToast.info(m.settings.nothingToImport, { description });
      } else {
        backupToast.success(m.settings.imported(imported.words, imported.reviews), {
          description,
        });
      }
    },
    onError: (error: Error) =>
      backupToast.error(commandErrorMessage(error, m.settings.importFailed)),
  }));

  return {
    exportData: () => void exportMutation.mutate(),
    importData: () => void importMutation.mutate(),
    get exporting() {
      return exportMutation.isPending;
    },
    get importing() {
      return importMutation.isPending;
    },
  };
}
