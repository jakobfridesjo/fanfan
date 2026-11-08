import { useMessages } from "@/shared/i18n/messages.ts";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog.tsx";
import { FieldGroup } from "@/shared/ui/shadcn/field.tsx";
import { Spinner } from "@/shared/ui/shadcn/spinner.tsx";
import type { FolderDialog } from "@/pages/library/model/use-library-manager.ts";
import { useFolderNameForm } from "@/pages/library/model/use-folder-name-form.ts";

interface FolderNameDialogProps {
  dialog: FolderDialog;
  saving: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/** Names a new folder, or renames one. */
export function FolderNameDialog({ dialog, saving, onSubmit, onClose }: FolderNameDialogProps) {
  const m = useMessages();
  const renaming = dialog.kind === "rename";
  const form = useFolderNameForm(renaming ? dialog.folder.name : "", onSubmit);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {renaming ? m.library.renameFolderTitle : m.library.newFolderTitle}
            </DialogTitle>
            {!renaming && <DialogDescription>{m.library.newFolderDescription}</DialogDescription>}
          </DialogHeader>
          <FieldGroup>
            <form.Field name="name">
              {(field) => (
                <field.TextField
                  id="folder-name"
                  label={m.library.folderName}
                  lang="zh"
                  autoComplete="off"
                  autoFocus
                  disabled={saving}
                />
              )}
            </form.Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {m.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              {renaming ? m.library.renameFolder : m.library.createFolder}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
