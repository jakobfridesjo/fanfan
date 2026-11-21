import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";

interface ChartTooltipRowData {
  key: string;
  label: string;
  value: string;
  color?: string;
}

interface ChartTooltipBodyProps {
  title?: JSX.Element;
  rows: ChartTooltipRowData[];
  total?: string;
  hideIndicator?: boolean;
  class?: string;
}

// Rendered through the chart's renderTooltipBody, which leaves the library's tooltip shell bare.
export function ChartTooltipBody(props: ChartTooltipBodyProps) {
  const m = useMessages();
  return (
    <div
      class={cn(
        "grid min-w-32 gap-1.5 rounded-xl bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10",
        props.class
      )}
    >
      <Show when={props.title}>
        <div class="font-medium">{props.title}</div>
      </Show>
      <div class="grid gap-1.5">
        <For each={props.rows} keyed={(row) => row.key}>
          {(row) => (
            <div class="flex w-full items-center gap-2">
              <Show when={!props.hideIndicator}>
                <div
                  class="size-2.5 shrink-0 rounded-xs"
                  style={{ "background-color": row().color }}
                />
              </Show>
              <div class="flex flex-1 items-center justify-between gap-4 leading-none">
                <span class="truncate text-muted-foreground">{row().label}</span>
                <span class="font-mono font-medium text-foreground tabular-nums">
                  {row().value}
                </span>
              </div>
            </div>
          )}
        </For>
      </div>
      <Show when={props.total !== undefined}>
        <div class="border-t border-border/50" />
        <div class="flex justify-between gap-4 leading-none font-medium">
          <span>{m.charts.total}</span>
          <span class="font-mono text-foreground tabular-nums">{props.total}</span>
        </div>
      </Show>
    </div>
  );
}
