import { Show, untrack } from "solid-js";
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
import { TextField } from "@/shared/ui/FormFields.tsx";
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
export function NameDialog(props: NameDialogProps) {
  const m = useMessages();
  const text = () => dialogText(props.dialog, m);
  // The dialog is mounted afresh for each name it asks for.
  const form = useNameForm(
    untrack(() => text().initialName),
    (name) => props.onSubmit(name)
  );
  const close = () => {
    if (!props.saving) props.onClose();
  };

  return (
    <Dialog open onClose={close}>
      <DialogContent>
        <form
          class="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{text().title}</DialogTitle>
            <Show when={text().description}>
              <DialogDescription>{text().description}</DialogDescription>
            </Show>
          </DialogHeader>
          <FieldGroup>
            <TextField
              field={form.field("name")}
              id="name"
              label={text().label}
              hideLabel
              lang="zh"
              autocomplete="off"
              autofocus
              disabled={props.saving}
            />
          </FieldGroup>
          <DialogFooter class="grid grid-cols-2 sm:flex">
            <Button variant="outline" onClick={() => props.onClose()} disabled={props.saving}>
              {m.common.cancel}
            </Button>
            <Button type="submit" disabled={props.saving}>
              <Show when={props.saving}>
                <Spinner decorative />
              </Show>
              {text().submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
