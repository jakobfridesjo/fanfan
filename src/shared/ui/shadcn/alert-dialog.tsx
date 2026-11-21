import type { JSX } from "@solidjs/web";
import { AlertDialog as AlertDialogPrimitive } from "@kobalte/core/alert-dialog";
import { cn } from "@/shared/lib/class-names.ts";

function AlertDialog(props: { open: boolean; onClose: () => void; children: JSX.Element }) {
  return (
    <AlertDialogPrimitive
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      {props.children}
    </AlertDialogPrimitive>
  );
}

function AlertDialogContent(props: { class?: string; children: JSX.Element }) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        data-slot="alert-dialog-overlay"
        class="fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm data-expanded:animate-in data-expanded:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        class={cn(
          "fixed inset-0 z-50 m-auto grid h-fit w-full max-w-xs gap-6 rounded-[min(var(--radius-4xl),24px)] bg-popover p-6 text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-100 outline-none sm:max-w-md dark:ring-foreground/10 data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          props.class
        )}
      >
        {props.children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogHeader(props: { class?: string; children: JSX.Element }) {
  return (
    <div
      data-slot="alert-dialog-header"
      class={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center sm:place-items-start sm:text-left",
        props.class
      )}
    >
      {props.children}
    </div>
  );
}

function AlertDialogFooter(props: { class?: string; children: JSX.Element }) {
  return (
    <div
      data-slot="alert-dialog-footer"
      class={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", props.class)}
    >
      {props.children}
    </div>
  );
}

function AlertDialogTitle(props: { class?: string; children: JSX.Element }) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      class={cn("font-heading text-lg font-medium", props.class)}
    >
      {props.children}
    </AlertDialogPrimitive.Title>
  );
}

function AlertDialogDescription(props: { class?: string; children: JSX.Element }) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      class={cn("text-sm text-balance text-muted-foreground md:text-pretty", props.class)}
    >
      {props.children}
    </AlertDialogPrimitive.Description>
  );
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
};
