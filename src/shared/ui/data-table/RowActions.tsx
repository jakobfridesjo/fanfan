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

export function RowActionButton({
  className,
  size = "icon",
  ...props
}: Omit<ComponentProps<typeof TooltipIconButton>, "variant">) {
  return (
    <TooltipIconButton
      variant="ghost"
      size={size}
      className={cn("rounded-full text-muted-foreground", className)}
      {...props}
    />
  );
}
