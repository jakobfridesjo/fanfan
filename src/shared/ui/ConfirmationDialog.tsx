import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/shadcn/alert-dialog.tsx";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Spinner } from "@/shared/ui/shadcn/spinner.tsx";

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: JSX.Element;
  confirmLabel: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  loading?: boolean;
  children?: JSX.Element;
}

export function ConfirmationDialog(props: ConfirmationDialogProps) {
  const m = useMessages();
  const close = () => {
    if (!props.loading) props.onClose();
  };

  return (
    <AlertDialog open={props.open} onClose={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <Show when={props.message}>
            <AlertDialogDescription>{props.message}</AlertDialogDescription>
          </Show>
        </AlertDialogHeader>
        {props.children}
        <AlertDialogFooter class="grid grid-cols-2 sm:flex">
          <Button variant="outline" onClick={close} disabled={props.loading}>
            {m.common.cancel}
          </Button>
          <Button
            variant={props.destructive ? "destructive" : "default"}
            onClick={() => props.onConfirm()}
            disabled={props.confirmDisabled || props.loading}
          >
            <Show when={props.loading}>
              <Spinner decorative />
            </Show>
            {props.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
