import { createMemo } from "solid-js";
import { barY, defineChart } from "@tanstack/charts";
import type { StabilityBucket } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { Chart } from "@/shared/ui/charts/Chart.tsx";
import { ChartTooltipBody } from "@/shared/ui/charts/ChartTooltipBody.tsx";
import { bandScale, countScale } from "@/shared/ui/charts/axis.ts";
import {
  CHART_MOTION,
  CHART_THEME,
  FILL_HOST_STYLE,
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
export default function StabilityChart(props: { data: StabilityBucket[] }) {
  const m = useMessages();
  const definition = createMemo(() => {
    const data = props.data;
    const y = countScale(Math.max(0, ...data.map((bucket) => bucket.count)));
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
        x: bandScale(
          { format: (key) => m.statistics.stability[key as StabilityBucket["key"]] },
          keys
        ),
        y,
      },
      margin: { top: 8, right: 8 },
      theme: CHART_THEME,
      focus: "nearest-x",
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: X_FOCUS_TOOLTIP,
    });
  });

  return (
    <Chart
      definition={definition()}
      renderer={CHART_MOTION}
      measureText={measureChartText}
      style={FILL_HOST_STYLE}
      ariaLabel={m.statistics.stabilityChart}
      renderTooltipBody={(target) => {
        const points = target.points;
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
