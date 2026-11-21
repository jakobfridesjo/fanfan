import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/class-names.ts";

type DivProps = Omit<ComponentProps<"div">, "class"> & { class?: string };

function Empty(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="empty"
      {...rest}
      class={cn(
        "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-3xl border-dashed p-12 text-center text-balance",
        props.class
      )}
    />
  );
}

function EmptyHeader(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="empty-header"
      {...rest}
      class={cn("flex max-w-sm flex-col items-center gap-2", props.class)}
    />
  );
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function EmptyMedia(props: DivProps & VariantProps<typeof emptyMediaVariants>) {
  const rest = omit(props, "class", "variant");
  return (
    <div
      data-slot="empty-icon"
      data-variant={props.variant ?? "default"}
      {...rest}
      class={cn(emptyMediaVariants({ variant: props.variant }), props.class)}
    />
  );
}

function EmptyTitle(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="empty-title"
      {...rest}
      class={cn("font-heading text-lg font-medium tracking-tight", props.class)}
    />
  );
}

function EmptyDescription(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="empty-description"
      {...rest}
      class={cn(
        "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        props.class
      )}
    />
  );
}

function EmptyContent(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="empty-content"
      {...rest}
      class={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
        props.class
      )}
    />
  );
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
