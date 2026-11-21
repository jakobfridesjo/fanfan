import { cn } from "@/shared/lib/class-names.ts";

function Separator(props: { class?: string }) {
  return (
    <div
      data-slot="separator"
      role="separator"
      aria-orientation="horizontal"
      class={cn("h-px w-full shrink-0 bg-border", props.class)}
    />
  );
}

export { Separator };
