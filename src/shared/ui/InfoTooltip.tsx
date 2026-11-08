import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/shared/lib/class-names.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/shadcn/tooltip.tsx";

interface InfoTooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function InfoTooltip({ label, children, className, contentClassName }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          aria-label={label}
          className="inline-flex cursor-help items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <Info className={cn("size-4", className)} />
        </TooltipTrigger>
        <TooltipContent className={cn("max-w-70", contentClassName)}>{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
