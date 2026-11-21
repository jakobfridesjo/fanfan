import type { JSX } from "@solidjs/web";
import { onCleanup } from "solid-js";
import {
  Content as DrawerPrimitiveContent,
  Portal as DrawerPrimitivePortal,
  Root as DrawerPrimitive,
  Title as DrawerPrimitiveTitle,
} from "@kobalte/core/drawer";
import { cn } from "@/shared/lib/class-names.ts";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: JSX.Element;
}

/** A sheet over the bottom of the page, swiped down to close. Not modal: the page behind stays in use. */
function Drawer(props: DrawerProps) {
  return (
    <DrawerPrimitive
      side="bottom"
      modal={false}
      open={props.open}
      onOpenChange={(open) => props.onOpenChange(open)}
    >
      {props.children}
    </DrawerPrimitive>
  );
}

function DrawerContent(props: {
  class?: string;
  /** Called once the sheet has slid away after closing. */
  onClosed?: () => void;
  children: JSX.Element;
}) {
  return (
    <DrawerPrimitivePortal>
      <DrawerPrimitiveContent
        data-slot="drawer-popup"
        // The page behind stays in use: a press on it neither closes the sheet nor takes its focus.
        onOpenAutoFocus={(event: Event) => event.preventDefault()}
        onCloseAutoFocus={(event: Event) => event.preventDefault()}
        onInteractOutside={(event: Event) => event.preventDefault()}
        class={cn(
          "fixed inset-x-0 bottom-0 z-50 m-2 flex max-h-[calc(100dvh-6rem)] min-h-0 flex-col rounded-[min(var(--radius-4xl),24px)] border border-popover bg-popover text-sm text-popover-foreground shadow-xl outline-none select-none data-transitioning:transition-transform data-transitioning:duration-450 data-transitioning:ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-border",
          props.class
        )}
      >
        <div
          data-slot="drawer-swipe-handle"
          aria-hidden="true"
          class="relative z-10 flex h-3 w-full shrink-0 cursor-grab items-end justify-center after:block after:h-1.5 after:w-[100px] after:shrink-0 after:rounded-full after:bg-muted active:cursor-grabbing"
        />
        <div
          data-slot="drawer-content"
          class="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain rounded-[inherit] select-text"
        >
          {props.children}
        </div>
        <Closed onClosed={() => props.onClosed?.()} />
      </DrawerPrimitiveContent>
    </DrawerPrimitivePortal>
  );
}

/** The sheet's content is taken off the page once it has slid away. */
function Closed(props: { onClosed: () => void }) {
  onCleanup(() => props.onClosed());
  return null;
}

function DrawerTitle(props: { class?: string; lang?: string; children: JSX.Element }) {
  return (
    <DrawerPrimitiveTitle
      data-slot="drawer-title"
      lang={props.lang}
      class={cn("font-heading text-base font-medium text-foreground", props.class)}
    >
      {props.children}
    </DrawerPrimitiveTitle>
  );
}

export { Drawer, DrawerContent, DrawerTitle };
