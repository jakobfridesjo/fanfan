import type { ReactNode } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { TooltipContent } from "@/shared/ui/shadcn/tooltip.tsx";

type ButtonProps = React.ComponentProps<typeof Button>;

/** Every icon button shares one tooltip, so a table row mounts triggers, not whole popups. */
const iconTooltip = Tooltip.createHandle<ReactNode>();

/** The tooltip every `TooltipIconButton` shows: render it once, next to the app. */
export function IconButtonTooltip() {
  return (
    <Tooltip.Root handle={iconTooltip}>
      {({ payload }) => <TooltipContent>{payload}</TooltipContent>}
    </Tooltip.Root>
  );
}

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
    <Tooltip.Trigger
      handle={iconTooltip}
      payload={tooltip}
      delay={0}
      data-slot="tooltip-trigger"
      render={<Button aria-label={label} {...buttonProps} />}
    >
      {children}
    </Tooltip.Trigger>
  );
}
