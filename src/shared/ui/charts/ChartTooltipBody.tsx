import type { ReactNode } from "react";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";

interface ChartTooltipRowData {
  key: string;
  label: string;
  value: string;
  color?: string;
}

interface ChartTooltipBodyProps {
  title?: ReactNode;
  rows: ChartTooltipRowData[];
  total?: string;
  hideIndicator?: boolean;
  className?: string;
}

// Rendered through the chart's renderTooltipBody, which leaves the library's tooltip shell bare.
export function ChartTooltipBody({
  title,
  rows,
  total,
  hideIndicator = false,
  className,
}: ChartTooltipBodyProps) {
  const m = useMessages();
  return (
    <div
      className={cn(
        "grid min-w-32 gap-1.5 rounded-xl bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10",
        className
      )}
    >
      {title && <div className="font-medium">{title}</div>}
      <div className="grid gap-1.5">
        {rows.map((row) => (
          <div key={row.key} className="flex w-full items-center gap-2">
            {!hideIndicator && (
              <div
                className="size-2.5 shrink-0 rounded-xs"
                style={{ backgroundColor: row.color }}
              />
            )}
            <div className="flex flex-1 items-center justify-between gap-4 leading-none">
              <span className="truncate text-muted-foreground">{row.label}</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {row.value}
              </span>
            </div>
          </div>
        ))}
      </div>
      {total !== undefined && (
        <>
          <div className="border-t border-border/50" />
          <div className="flex justify-between gap-4 leading-none font-medium">
            <span>{m.charts.total}</span>
            <span className="font-mono text-foreground tabular-nums">{total}</span>
          </div>
        </>
      )}
    </div>
  );
}
