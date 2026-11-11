import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { formatWireDateShort, parseWireDate } from "@/shared/lib/date.ts";
import { appLocale } from "@/shared/lib/locale.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { CHART_GRID, TICK_LABELS } from "@/shared/ui/charts/chart-defaults.ts";

/** Room the count axis takes beside the plot. */
export const COUNT_AXIS_WIDTH = 40;

/** A date tick's label: weekday within a week, day number within a month, else month and day. */
export function formatDateTick(isoDate: string, days: number): string {
  if (days <= 1) return formatWireDateShort(isoDate);
  const date = parseWireDate(isoDate);
  if (days <= 7) return date.toLocaleDateString(appLocale(), { weekday: "short" });
  if (days <= 31) return String(date.getDate());
  return formatWireDateShort(isoDate);
}

const NICE_STEPS = [1, 2, 5];

function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  return (NICE_STEPS.find((step) => step * magnitude >= rough) ?? 10) * magnitude;
}

/** Whole-number ticks from zero that cover `max`, for counts that must not show decimals. */
export function integerTicks(max: number, count = 4): number[] {
  const top = Math.max(1, max);
  const step = niceStep(Math.max(1, top / count));
  const last = Math.ceil(top / step) * step;
  return Array.from({ length: last / step + 1 }, (_, index) => index * step);
}

export function countAxis(max: number): {
  scale: ReturnType<typeof scaleLinear>;
  values: number[];
} {
  const values = integerTicks(max);
  return { scale: scaleLinear().domain([0, values.at(-1) ?? 1]), values };
}

/** Every nth value, so tick labels stay evenly spaced whatever the range and chart width. */
export function evenlySpaced<T>(values: readonly T[], width: number, slotWidth = 32): T[] {
  const slots = Math.max(1, Math.floor(width / slotWidth));
  const step = Math.ceil(values.length / slots);
  return values.filter((_, index) => index % step === 0);
}

/** The y scale of a bar chart of counts: whole numbers from zero, with grid lines. */
export function countScale(max: number) {
  const { scale, values } = countAxis(max);
  return {
    scale,
    grid: CHART_GRID,
    axis: {
      line: false,
      ticks: { values, size: 0, padding: 8, format: formatInteger },
      tickLabels: TICK_LABELS,
    },
  };
}

/** The x scale of a bar chart: one band a bar, labelled as `ticks` says. */
export function bandScale(
  ticks: { values?: string[]; format: (value: string) => string },
  domain?: string[]
) {
  return {
    scale: () => {
      const scale = scaleBand<string>().padding(0.3);
      return domain ? scale.domain(domain) : scale;
    },
    axis: {
      line: false,
      ticks: { size: 0, padding: 4, ...ticks },
      tickLabels: { ...TICK_LABELS, thin: false },
    },
  };
}
