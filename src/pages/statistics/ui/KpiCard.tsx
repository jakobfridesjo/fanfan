import { Show } from "solid-js";
import { cn } from "@/shared/lib/class-names.ts";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  isLoading?: boolean;
  class?: string;
}

/** One headline figure: a small caps label over a large number. */
export function KpiCard(props: KpiCardProps) {
  return (
    <Card
      size="sm"
      class={cn(
        "shrink-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        props.class
      )}
      tabindex={0}
      role="group"
      aria-label={props.label}
    >
      <CardContent class="flex flex-col gap-2">
        <span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {props.label}
        </span>
        <Show when={!props.isLoading} fallback={<Skeleton class="h-7 w-16" />}>
          <div class="flex items-baseline gap-2">
            <span class="text-kpi font-semibold tabular-nums">{props.value}</span>
            <Show when={props.unit}>
              <span class="text-xs leading-none text-muted-foreground">{props.unit}</span>
            </Show>
          </div>
        </Show>
      </CardContent>
    </Card>
  );
}
