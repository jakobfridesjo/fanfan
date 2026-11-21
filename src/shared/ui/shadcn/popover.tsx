import type { JSX, ValidComponent } from "@solidjs/web";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import {
  Popover as PopoverPrimitive,
  type PopoverRootProps,
  type PopoverTriggerProps,
} from "@kobalte/core/popover";
import { cn } from "@/shared/lib/class-names.ts";

function Popover(props: PopoverRootProps) {
  return <PopoverPrimitive placement="bottom" gutter={4} {...props} />;
}

function PopoverTrigger<T extends ValidComponent = "button">(
  props: PolymorphicProps<T, PopoverTriggerProps<T>>
) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent(props: { class?: string; children: JSX.Element }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        class={cn(
          "z-50 flex w-72 origin-(--kb-popover-content-transform-origin) flex-col gap-4 rounded-3xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-hidden duration-100 dark:ring-foreground/10 data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          props.class
        )}
      >
        {props.children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
