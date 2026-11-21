import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { cn } from "@/shared/lib/class-names.ts";
import { STATUS_TONE_CLASSNAMES, type StatusTone } from "@/shared/ui/status-tone.ts";

export function StatusBadge(
  props: Omit<ComponentProps<typeof Badge>, "variant"> & { tone: StatusTone }
) {
  const rest = omit(props, "tone", "class");
  return (
    <Badge
      variant="secondary"
      {...rest}
      class={cn(STATUS_TONE_CLASSNAMES[props.tone], props.class)}
    />
  );
}
