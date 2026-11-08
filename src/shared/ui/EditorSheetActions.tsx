import { useSelector } from "@tanstack/react-store";
import type { AnyFormApi } from "@tanstack/react-form";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Spinner } from "@/shared/ui/shadcn/spinner.tsx";

interface EditorSheetActionsProps {
  isEditing: boolean;
  pending: boolean;
  saveDisabled?: boolean;
  createLabel?: string;
  onCancel: () => void;
  onSave: () => void;
}

export function EditorSheetActions({
  isEditing,
  pending,
  saveDisabled = false,
  createLabel = "Create",
  onCancel,
  onSave,
}: EditorSheetActionsProps) {
  return (
    <>
      <Button variant="outline" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button onClick={onSave} disabled={pending || saveDisabled}>
        {pending && <Spinner data-icon="inline-start" />}
        {isEditing ? "Save" : createLabel}
      </Button>
    </>
  );
}

interface FormSheetActionsProps extends Omit<EditorSheetActionsProps, "saveDisabled" | "onSave"> {
  form: Pick<AnyFormApi, "atom" | "handleSubmit">;
}

/** Sheet actions whose Save submits `form`, enabled only while it can submit. */
export function FormSheetActions({ form, ...props }: FormSheetActionsProps) {
  const canSubmit = useSelector(form.atom, (state) => state.canSubmit);
  return (
    <EditorSheetActions
      {...props}
      saveDisabled={!canSubmit}
      onSave={() => void form.handleSubmit()}
    />
  );
}
