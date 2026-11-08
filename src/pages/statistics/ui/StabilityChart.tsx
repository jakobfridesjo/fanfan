import { useMemo } from "react";
import { barY, defineChart } from "@tanstack/charts";
import { RendererChart } from "@tanstack/charts/react/tooltip";
import { scaleBand } from "@tanstack/charts/scales/band";
import type { StabilityBucket } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { ChartTooltipBody } from "@/shared/ui/charts/ChartTooltipBody.tsx";
import { countAxis } from "@/shared/ui/charts/axis.ts";
import {
  CHART_GRID,
  CHART_MOTION,
  CHART_THEME,
  FILL_HOST_STYLE,
  TICK_LABELS,
  X_FOCUS_TOOLTIP,
  measureChartText,
} from "@/shared/ui/charts/chart-defaults.ts";

// Weak to strong memory, light to dark.
const BUCKET_COLORS = [
  "var(--chart-1)",
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Reviewed learning words by FSRS stability, shortest first. */
export function StabilityChart({ data }: { data: StabilityBucket[] }) {
  const m = useMessages();
  const definition = useMemo(() => {
    const yAxis = countAxis(Math.max(0, ...data.map((bucket) => bucket.count)));
    const keys = data.map((bucket) => bucket.key);

    return defineChart({
      marks: [
        barY(data, {
          x: "key",
          y: "count",
          key: "key",
          fill: (bucket) => BUCKET_COLORS[keys.indexOf(bucket.key)] ?? BUCKET_COLORS[0],
          radius: { end: 4 },
        }),
      ],
      scales: {
        x: {
          scale: () => scaleBand<string>().domain(keys).padding(0.3),
          axis: {
            line: false,
            ticks: {
              size: 0,
              padding: 4,
              format: (key: string) => m.statistics.stability[key as StabilityBucket["key"]],
            },
            tickLabels: { ...TICK_LABELS, thin: false },
          },
        },
        y: {
          scale: yAxis.scale,
          grid: CHART_GRID,
          axis: {
            line: false,
            ticks: { values: yAxis.values, size: 0, padding: 8, format: formatInteger },
            tickLabels: TICK_LABELS,
          },
        },
      },
      margin: { top: 8, right: 8 },
      theme: CHART_THEME,
      focus: "nearest-x",
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: X_FOCUS_TOOLTIP,
    });
  }, [data, m]);

  return (
    <RendererChart
      definition={definition}
      renderer={CHART_MOTION}
      measureText={measureChartText}
      style={FILL_HOST_STYLE}
      ariaLabel={m.statistics.stabilityChart}
      renderTooltipBody={({ points }) => {
        const bucket = points[0]?.datum;
        if (!bucket) return null;
        return (
          <ChartTooltipBody
            title={m.statistics.stability[bucket.key]}
            rows={[{ key: "count", label: m.statistics.words, value: formatInteger(bucket.count) }]}
            hideIndicator
          />
        );
      }}
    />
  );
}
