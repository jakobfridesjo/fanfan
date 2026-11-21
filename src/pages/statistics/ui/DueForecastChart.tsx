import { createMemo } from "solid-js";
import { barY, defineChart } from "@tanstack/charts";
import type { DueDay } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatWireDateShort } from "@/shared/lib/date.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { Chart } from "@/shared/ui/charts/Chart.tsx";
import { ChartTooltipBody } from "@/shared/ui/charts/ChartTooltipBody.tsx";
import {
  COUNT_AXIS_WIDTH,
  bandScale,
  countScale,
  evenlySpaced,
  formatDateTick,
} from "@/shared/ui/charts/axis.ts";
import {
  CHART_MOTION,
  CHART_THEME,
  FILL_HOST_STYLE,
  X_FOCUS_TOOLTIP,
  measureChartText,
} from "@/shared/ui/charts/chart-defaults.ts";

/** Learning words per day over the forecast; the first day is today and holds overdue words. */
export default function DueForecastChart(props: { data: DueDay[] }) {
  const m = useMessages();
  const definition = createMemo(() => {
    const data = props.data;
    const today = data[0]?.date;
    const y = countScale(Math.max(0, ...data.map((day) => day.count)));
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
          x: bandScale({
            values: evenlySpaced(dates, width - COUNT_AXIS_WIDTH, 40),
            format: label,
          }),
          y,
        },
        margin: { top: 8, right: 8 },
        theme: CHART_THEME,
      }),
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
      ariaLabel={m.statistics.forecastChart}
      renderTooltipBody={(target) => {
        const points = target.points;
        const day = points[0]?.datum;
        if (!day) return null;
        return (
          <ChartTooltipBody
            title={
              day.date === props.data[0]?.date ? m.statistics.today : formatWireDateShort(day.date)
            }
            rows={[{ key: "count", label: m.statistics.words, value: formatInteger(day.count) }]}
            hideIndicator
          />
        );
      }}
    />
  );
}
