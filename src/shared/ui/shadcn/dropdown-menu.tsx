import type { JSX, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import {
  DropdownMenu as MenuPrimitive,
  type DropdownMenuContentProps,
  type DropdownMenuRootProps,
  type DropdownMenuTriggerProps,
} from "@kobalte/core/dropdown-menu";
import { cn } from "@/shared/lib/class-names.ts";

function DropdownMenu(props: DropdownMenuRootProps) {
  return <MenuPrimitive placement="bottom-start" gutter={4} {...props} />;
}

function DropdownMenuTrigger<T extends ValidComponent = "button">(
  props: PolymorphicProps<T, DropdownMenuTriggerProps<T>>
) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent<T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuContentProps<T>> & { class?: string }
) {
  const rest = omit(props as { class?: string }, "class");
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="dropdown-menu-content"
        {...rest}
        class={cn(
          "z-50 max-h-(--kb-popper-content-available-height) min-w-32 origin-(--kb-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-2xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 duration-100 outline-none dark:ring-foreground/10 data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95",
          props.class
        )}
      />
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuItem(props: {
  variant?: "default" | "destructive";
  onSelect: () => void;
  children: JSX.Element;
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={props.variant ?? "default"}
      onSelect={() => props.onSelect()}
      class="group/dropdown-menu-item relative flex min-h-7 cursor-default items-center gap-2 rounded-xl px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    >
      {props.children}
    </MenuPrimitive.Item>
  );
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
