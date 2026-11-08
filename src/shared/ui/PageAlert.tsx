import type * as React from "react";
import { Alert } from "@/shared/ui/shadcn/alert.tsx";
import { cn } from "@/shared/lib/class-names.ts";

/** An `Alert` on the page canvas, edged like the `Card`s beside it. */
export function PageAlert({ className, ...props }: React.ComponentProps<typeof Alert>) {
  return (
    <Alert
      className={cn(
        "border-transparent ring-1 ring-foreground/5 dark:ring-foreground/10",
        className
      )}
      {...props}
    />
  );
}
