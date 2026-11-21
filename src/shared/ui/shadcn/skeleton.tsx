import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "@/shared/lib/class-names.ts";

function Skeleton(props: Omit<ComponentProps<"div">, "class"> & { class?: string }) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="skeleton"
      {...rest}
      class={cn("animate-pulse rounded-2xl bg-muted", props.class)}
    />
  );
}

export { Skeleton };
