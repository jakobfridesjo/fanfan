import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/shadcn/sheet.tsx";
import { useDiscardChangesGuard } from "@/shared/ui/use-unsaved-changes-guards.tsx";
import { cn } from "@/shared/lib/class-names.ts";

interface EditorSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "default" | "wide";
  pending?: boolean;
  dirty?: boolean;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

export function EditorSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "default",
  pending = false,
  dirty = false,
  headerClassName,
  bodyClassName,
  footerClassName,
}: EditorSheetProps) {
  const guard = useDiscardChangesGuard({ dirty, pending, onClose });

  return (
    <Sheet open={open} onOpenChange={guard.onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full w-full flex-col gap-0 overflow-hidden p-0 *:data-[slot=sheet-close]:top-3.5 *:data-[slot=sheet-close]:right-3.5",
          size === "wide" ? "data-[side=right]:sm:max-w-4xl" : "data-[side=right]:sm:max-w-xl"
        )}
      >
        <SheetHeader className={cn("border-b px-6 py-4 pr-16", headerClassName)}>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className={cn("min-h-0 flex-1 overflow-y-auto p-6", bodyClassName)}>{children}</div>
        {footer && (
          <SheetFooter
            className={cn(
              "mx-0 mb-0 shrink-0 flex-col-reverse border-t bg-muted/20 p-3 sm:flex-row sm:justify-end",
              footerClassName
            )}
          >
            {footer}
          </SheetFooter>
        )}
        {guard.discardDialog}
      </SheetContent>
    </Sheet>
  );
}
