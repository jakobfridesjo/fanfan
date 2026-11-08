import { ReactNode, useState } from "react";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";
import { Input } from "@/shared/ui/shadcn/input.tsx";
import { Label } from "@/shared/ui/shadcn/label.tsx";

interface TypeToConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmValue: string;
  confirmLabel: string;
  loading?: boolean;
}

export function TypeToConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmValue,
  confirmLabel,
  loading = false,
}: TypeToConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    setTypedValue("");
  }

  const matches = confirmValue !== "" && typedValue === confirmValue;

  return (
    <ConfirmationDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      message={description}
      confirmLabel={confirmLabel}
      destructive
      confirmDisabled={!matches}
      loading={loading}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="type-to-confirm-input" className="text-sm text-muted-foreground">
          Type <span className="font-mono font-medium text-foreground">{confirmValue}</span> to
          confirm
        </Label>
        <Input
          id="type-to-confirm-input"
          value={typedValue}
          onChange={(event) => setTypedValue(event.target.value)}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </ConfirmationDialog>
  );
}
