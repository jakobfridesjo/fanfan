import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { Content as DialogContentPrimitive, Dialog as DialogPrimitive } from "@kobalte/core/dialog";
import { X } from "lucide";
import { cn } from "@/shared/lib/class-names.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";

interface DialogProps {
  open: boolean;
  /** Called when Escape, the close button or a press outside asks to close; leave it out for a dialog that only its work can finish. */
  onClose?: () => void;
  children: JSX.Element;
}

function Dialog(props: DialogProps) {
  return (
    <DialogPrimitive
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose?.();
      }}
    >
      {props.children}
    </DialogPrimitive>
  );
}

function DialogContent(props: {
  class?: string;
  showCloseButton?: boolean;
  /** What the close button says to screen readers. */
  closeLabel?: string;
  children: JSX.Element;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        class="fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm data-expanded:animate-in data-expanded:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      {/* Not `DialogPrimitive.Content`: importing Kobalte's alert dialog swaps that for its own. */}
      <DialogContentPrimitive
        data-slot="dialog-content"
        class={cn(
          "fixed inset-0 z-50 m-auto grid h-fit w-full max-w-[calc(100%-2rem)] gap-6 rounded-[min(var(--radius-4xl),24px)] bg-popover p-6 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-100 outline-none sm:max-w-md dark:ring-foreground/10 data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          props.class
        )}
      >
        {props.children}
        <Show when={props.showCloseButton}>
          <DialogPrimitive.CloseButton
            as={Button}
            data-slot="dialog-close"
            variant="ghost"
            size="icon-sm"
            class="absolute top-4 right-4 bg-secondary"
            aria-label={props.closeLabel}
          >
            <Icon icon={X} />
          </DialogPrimitive.CloseButton>
        </Show>
      </DialogContentPrimitive>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader(props: { class?: string; children: JSX.Element }) {
  return (
    <div data-slot="dialog-header" class={cn("flex flex-col gap-1.5", props.class)}>
      {props.children}
    </div>
  );
}

function DialogFooter(props: { class?: string; children: JSX.Element }) {
  return (
    <div
      data-slot="dialog-footer"
      class={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", props.class)}
    >
      {props.children}
    </div>
  );
}

function DialogTitle(props: { class?: string; children: JSX.Element }) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      class={cn("font-heading text-base leading-none font-medium", props.class)}
    >
      {props.children}
    </DialogPrimitive.Title>
  );
}

function DialogDescription(props: { class?: string; lang?: string; children: JSX.Element }) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      lang={props.lang}
      class={cn("text-sm text-muted-foreground", props.class)}
    >
      {props.children}
    </DialogPrimitive.Description>
  );
}

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle };
