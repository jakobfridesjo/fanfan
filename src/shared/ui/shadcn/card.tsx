import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "@/shared/lib/class-names.ts";

type DivProps = Omit<ComponentProps<"div">, "class"> & { class?: string };

function Card(props: DivProps & { size?: "default" | "sm" }) {
  const rest = omit(props, "class", "size");
  return (
    <div
      data-slot="card"
      data-size={props.size ?? "default"}
      {...rest}
      class={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-[min(var(--radius-4xl),24px)] bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/5 [--card-spacing:--spacing(5)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] dark:ring-foreground/10 *:[img:first-child]:rounded-t-[min(var(--radius-4xl),24px)] *:[img:last-child]:rounded-b-[min(var(--radius-4xl),24px)]",
        props.class
      )}
    />
  );
}

function CardHeader(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="card-header"
      {...rest}
      class={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 rounded-t-[min(var(--radius-4xl),24px)] px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        props.class
      )}
    />
  );
}

function CardTitle(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="card-title"
      {...rest}
      class={cn("font-heading text-base font-medium", props.class)}
    />
  );
}

function CardDescription(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="card-description"
      {...rest}
      class={cn("text-sm text-muted-foreground", props.class)}
    />
  );
}

function CardAction(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="card-action"
      {...rest}
      class={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", props.class)}
    />
  );
}

function CardContent(props: DivProps) {
  const rest = omit(props, "class");
  return <div data-slot="card-content" {...rest} class={cn("px-(--card-spacing)", props.class)} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent };
