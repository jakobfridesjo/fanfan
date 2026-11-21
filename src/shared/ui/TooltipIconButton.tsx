import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { Link, type LinkProps } from "@tanstack/solid-router";
import { Button, buttonVariants } from "@/shared/ui/shadcn/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/shadcn/tooltip.tsx";

interface TooltipIconButtonProps extends Omit<ComponentProps<typeof Button>, "children"> {
  label: string;
  tooltip?: JSX.Element;
  children: JSX.Element;
}

export function TooltipIconButton(props: TooltipIconButtonProps) {
  const buttonProps = omit(props, "label", "tooltip", "children");
  return (
    <Tooltip>
      <TooltipTrigger as={Button} aria-label={props.label} {...buttonProps}>
        {props.children}
      </TooltipTrigger>
      <TooltipContent>{props.tooltip ?? props.label}</TooltipContent>
    </Tooltip>
  );
}

interface TooltipIconLinkProps extends Pick<LinkProps, "to"> {
  label: string;
  children: JSX.Element;
}

/** An outline icon button that navigates: a real link, so it keeps the link role. */
export function TooltipIconLink(props: TooltipIconLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        as={Link}
        to={props.to}
        aria-label={props.label}
        class={buttonVariants({ variant: "outline", size: "icon" })}
      >
        {props.children}
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  );
}
