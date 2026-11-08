import { useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";

interface DiscardChangesGuardOptions {
  dirty: boolean;
  pending?: boolean;
  onClose: () => void;
}

export function useDiscardChangesGuard({
  dirty,
  pending = false,
  onClose,
}: DiscardChangesGuardOptions) {
  const [confirming, setConfirming] = useState(false);

  const requestClose = () => {
    if (pending) return;
    if (dirty) {
      setConfirming(true);
      return;
    }
    onClose();
  };

  const discardDialog = (
    <ConfirmationDialog
      open={confirming}
      onClose={() => setConfirming(false)}
      onConfirm={() => {
        setConfirming(false);
        onClose();
      }}
      title="Discard Changes"
      message="Your unsaved changes will be lost."
      confirmLabel="Discard"
      destructive
    />
  );

  return {
    onOpenChange: (nextOpen: boolean) => {
      if (!nextOpen) requestClose();
    },
    discardDialog,
  };
}

export function useLeaveGuard(dirty: boolean) {
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  });

  return (
    <ConfirmationDialog
      open={blocker.status === "blocked"}
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
      title="Discard Changes"
      message="Your unsaved changes will be lost."
      confirmLabel="Discard"
      destructive
    />
  );
}
