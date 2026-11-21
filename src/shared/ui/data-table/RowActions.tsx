import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { cn } from "@/shared/lib/class-names.ts";

export function RowActions(props: { children: JSX.Element; class?: string }) {
  return (
    <div class={cn("flex items-center justify-center gap-1", props.class)}>{props.children}</div>
  );
}

export function RowActionButton(props: Omit<ComponentProps<typeof TooltipIconButton>, "variant">) {
  const rest = omit(props, "class", "size");
  return (
    <TooltipIconButton
      variant="ghost"
      size={props.size ?? "icon"}
      {...rest}
      class={cn("rounded-full text-muted-foreground", props.class)}
    />
  );
}
