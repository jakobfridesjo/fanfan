import { useMemo } from "react";
import { barY, defineChart } from "@tanstack/charts";
import { RendererChart } from "@tanstack/charts/react/tooltip";
import { scaleBand } from "@tanstack/charts/scales/band";
import type { ReviewDay } from "@/shared/api/commands.ts";
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

const RATINGS = ["again", "hard", "good", "easy"] as const;
type RatingKey = (typeof RATINGS)[number];
const RATING_NUMBERS: Record<RatingKey, 1 | 2 | 3 | 4> = { again: 1, hard: 2, good: 3, easy: 4 };
// Darkest for "again", so the failures at the bottom of each bar stand out.
const RATING_COLORS = ["var(--chart-5)", "var(--chart-4)", "var(--chart-2)", "var(--chart-1)"];
const Y_AXIS_WIDTH = 40;

interface ReviewPoint {
  date: string;
  rating: RatingKey;
  count: number;
}

export function ReviewsChart({ data }: { data: ReviewDay[] }) {
  const m = useMessages();
  const definition = useMemo(() => {
    const rows: ReviewPoint[] = data.flatMap((day) =>
      RATINGS.map((rating) => ({ date: day.date, rating, count: day[rating] }))
    );
    const yAxis = countAxis(
      Math.max(0, ...data.map((day) => day.again + day.hard + day.good + day.easy))
    );
    const dates = data.map((day) => day.date);

    return defineChart({
      chart: ({ width }) => ({
        marks: [
          barY(rows, {
            x: "date",
            y: "count",
            z: "rating",
            color: "rating",
            key: (row) => `${row.date}:${row.rating}`,
            radius: { end: 4 },
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand<string>().padding(0.3),
            axis: {
              line: false,
              ticks: {
                values: evenlySpaced(dates, width - Y_AXIS_WIDTH),
                size: 0,
                padding: 4,
                format: (value: string) => formatDateTick(value, dates.length),
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
        color: { domain: [...RATINGS], range: RATING_COLORS },
        margin: { top: 8, right: 8 },
        theme: CHART_THEME,
      }),
      focus: "group-x",
      maxFocusDistance: Number.POSITIVE_INFINITY,
      tooltip: { ...X_FOCUS_TOOLTIP, sort: "color-domain" },
    });
  }, [data]);

  return (
    <RendererChart
      definition={definition}
      renderer={CHART_MOTION}
      measureText={measureChartText}
      style={FILL_HOST_STYLE}
      ariaLabel={m.statistics.reviewsChart}
      renderTooltipBody={({ points }) => {
        const first = points[0];
        if (!first) return null;
        const total = points.reduce((sum, point) => sum + point.datum.count, 0);
        return (
          <ChartTooltipBody
            title={formatWireDateShort(first.datum.date)}
            rows={points.map((point) => ({
              key: point.datum.rating,
              label: m.review.ratings[RATING_NUMBERS[point.datum.rating]],
              value: formatInteger(point.datum.count),
              color: point.color,
            }))}
            total={formatInteger(total)}
          />
        );
      }}
    />
  );
}
