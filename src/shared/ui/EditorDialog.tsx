import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/shared/ui/shadcn/dialog.tsx";
import { useDiscardChangesGuard } from "@/shared/ui/use-unsaved-changes-guards.tsx";
import { cn } from "@/shared/lib/class-names.ts";

interface EditorDialogProps {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  pending?: boolean;
  dirty?: boolean;
}

export function EditorDialog({
  open,
  onClose,
  header,
  children,
  footer,
  pending = false,
  dirty = false,
}: EditorDialogProps) {
  const guard = useDiscardChangesGuard({ dirty, pending, onClose });

  return (
    <Dialog open={open} onOpenChange={guard.onOpenChange}>
      <DialogContent className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90vh] sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-7xl sm:rounded-xl *:data-[slot=dialog-close]:top-2.5 *:data-[slot=dialog-close]:right-2.5">
        {header}
        {children}
        {footer && <EditorDialogFooter>{footer}</EditorDialogFooter>}
        {guard.discardDialog}
      </DialogContent>
    </Dialog>
  );
}

export function EditorDialogSidebar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col bg-muted/20 sm:h-full sm:w-100 sm:shrink-0 sm:border-r",
        className
      )}
    >
      {children}
    </div>
  );
}

export function EditorDialogFooter({ children }: { children: ReactNode }) {
  return (
    <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-muted/20 p-3">
      {children}
    </DialogFooter>
  );
}
