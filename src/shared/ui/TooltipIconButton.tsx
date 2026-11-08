import type { ReactNode } from "react";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/shadcn/tooltip.tsx";

type ButtonProps = React.ComponentProps<typeof Button>;

interface TooltipIconButtonProps extends Omit<ButtonProps, "children"> {
  label: string;
  tooltip?: ReactNode;
  children: ReactNode;
}

export function TooltipIconButton({
  label,
  tooltip = label,
  children,
  ...buttonProps
}: TooltipIconButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button aria-label={label} {...buttonProps} />}>
          {children}
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
