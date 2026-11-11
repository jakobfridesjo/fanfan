import type { Messages } from "@/shared/i18n/messages-en.ts";
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
import type { NameDialog as NameDialogState } from "@/pages/library/model/use-library-manager.ts";
import { useNameForm } from "@/pages/library/model/use-name-form.ts";

interface NameDialogProps {
  dialog: NameDialogState;
  saving: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

function dialogText(dialog: NameDialogState, m: Messages) {
  switch (dialog.kind) {
    case "createFolder":
      return {
        title: m.library.newFolderTitle,
        description: m.library.newFolderDescription,
        label: m.library.folderName,
        initialName: "",
        submitLabel: m.library.createFolder,
      };
    case "renameFolder":
      return {
        title: m.library.renameFolderTitle,
        description: null,
        label: m.library.folderName,
        initialName: dialog.folder.name,
        submitLabel: m.common.rename,
      };
    case "renameBook":
      return {
        title: m.library.renameBookTitle,
        description: null,
        label: m.library.bookTitle,
        initialName: dialog.document.title,
        submitLabel: m.common.rename,
      };
  }
}

/** Names a new folder, or renames a folder or a book. */
export function NameDialog({ dialog, saving, onSubmit, onClose }: NameDialogProps) {
  const m = useMessages();
  const { title, description, label, initialName, submitLabel } = dialogText(dialog, m);
  const form = useNameForm(initialName, onSubmit);

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
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <FieldGroup>
            <form.Field name="name">
              {(field) => (
                <field.TextField
                  id="name"
                  label={label}
                  hideLabel
                  lang="zh"
                  autoComplete="off"
                  autoFocus
                  disabled={saving}
                />
              )}
            </form.Field>
          </FieldGroup>
          <DialogFooter className="grid grid-cols-2 sm:flex">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {m.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
