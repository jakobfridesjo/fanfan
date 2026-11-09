import type { ComponentProps, ReactNode } from "react";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { cn } from "@/shared/lib/class-names.ts";

interface RowActionsProps {
  children: ReactNode;
  className?: string;
}

export function RowActions({ children, className }: RowActionsProps) {
  return <div className={cn("flex items-center justify-center gap-1", className)}>{children}</div>;
}

type RowActionButtonProps = Omit<ComponentProps<typeof TooltipIconButton>, "variant">;
type RowActionClick = NonNullable<RowActionButtonProps["onClick"]>;

// A row action never doubles as a click on its row, so the event stops here.
export function RowActionButton({
  className,
  size = "icon",
  onClick,
  ...props
}: RowActionButtonProps) {
  return (
    <TooltipIconButton
      variant="ghost"
      size={size}
      className={cn("rounded-full text-muted-foreground", className)}
      onClick={(event: Parameters<RowActionClick>[0]) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      {...props}
    />
  );
}
