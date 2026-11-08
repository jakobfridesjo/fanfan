import { useMemo } from "react";
import { barY, defineChart } from "@tanstack/charts";
import { RendererChart } from "@tanstack/charts/react/tooltip";
import { scaleBand } from "@tanstack/charts/scales/band";
import type { DueDay } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatWireDateShort } from "@/shared/lib/date.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { ChartTooltipBody } from "@/shared/ui/charts/ChartTooltipBody.tsx";
import { countAxis, evenlySpaced, formatDateTick } from "@/shared/ui/charts/axis.ts";
import {
  CHART_GRID,
  CHART_MOTION,
  CHART_THEME,
  FILL_HOST_STYLE,
  TICK_LABELS,
  X_FOCUS_TOOLTIP,
  measureChartText,
} from "@/shared/ui/charts/chart-defaults.ts";

const Y_AXIS_WIDTH = 40;

/** Learning words per day over the forecast; the first day is today and holds overdue words. */
export function DueForecastChart({ data }: { data: DueDay[] }) {
  const m = useMessages();
  const definition = useMemo(() => {
    const today = data[0]?.date;
    const yAxis = countAxis(Math.max(0, ...data.map((day) => day.count)));
    const dates = data.map((day) => day.date);
    const label = (date: string) =>
      date === today ? m.statistics.today : formatDateTick(date, dates.length);

    return defineChart({
      chart: ({ width }) => ({
        marks: [
          barY(data, {
            x: "date",
            y: "count",
            key: "date",
            fill: (day) => (day.date === today ? "var(--chart-4)" : "var(--chart-2)"),
            radius: { end: 4 },
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand<string>().padding(0.3),
            axis: {
              line: false,
              ticks: {
                values: evenlySpaced(dates, width - Y_AXIS_WIDTH, 40),
                size: 0,
                padding: 4,
                format: label,
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
      }),
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
      ariaLabel={m.statistics.forecastChart}
      renderTooltipBody={({ points }) => {
        const day = points[0]?.datum;
        if (!day) return null;
        return (
          <ChartTooltipBody
            title={day.date === data[0]?.date ? m.statistics.today : formatWireDateShort(day.date)}
            rows={[{ key: "count", label: m.statistics.words, value: formatInteger(day.count) }]}
            hideIndicator
          />
        );
      }}
    />
  );
}
