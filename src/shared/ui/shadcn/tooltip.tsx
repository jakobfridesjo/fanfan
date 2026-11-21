import type { ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import {
  Tooltip as TooltipPrimitive,
  type TooltipContentProps,
  type TooltipRootProps,
  type TooltipTriggerProps,
} from "@kobalte/core/tooltip";
import { cn } from "@/shared/lib/class-names.ts";

function Tooltip(props: TooltipRootProps) {
  return <TooltipPrimitive openDelay={0} closeDelay={0} placement="top" gutter={8} {...props} />;
}

function TooltipTrigger<T extends ValidComponent = "button">(
  props: PolymorphicProps<T, TooltipTriggerProps<T>>
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent<T extends ValidComponent = "div">(
  props: PolymorphicProps<T, TooltipContentProps<T>> & { class?: string }
) {
  const rest = omit(props as { class?: string }, "class");
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        {...rest}
        class={cn(
          "z-50 inline-flex w-fit max-w-xs origin-(--kb-tooltip-content-transform-origin) items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs text-background data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          props.class
        )}
      >
        {props.children}
        <TooltipPrimitive.Arrow class="fill-foreground" size={12} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
