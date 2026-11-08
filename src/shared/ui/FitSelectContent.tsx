import type * as React from "react";

import { cn } from "@/shared/lib/class-names.ts";
import { SelectContent } from "@/shared/ui/shadcn/select.tsx";

/** A select popup as wide as its longest option, capped to the viewport. */
export function FitSelectContent({
  className,
  ...props
}: React.ComponentProps<typeof SelectContent>) {
  return (
    <SelectContent
      className={cn(
        "w-max min-w-(--anchor-width) max-w-[calc(100vw-2rem)] overflow-x-auto",
        className
      )}
      {...props}
    />
  );
}
