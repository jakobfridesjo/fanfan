import { appLocale } from "@/shared/lib/locale.ts";

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const MONTH_DAY_OPTIONS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

const format = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(appLocale(), options).format(date);

function toValidDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  return toValidDate(value)?.toLocaleDateString(appLocale(), SHORT_DATE_OPTIONS) ?? "Invalid Date";
}

export function formatShortDateTime(value: string): string {
  const date = toValidDate(value);
  return date ? format(date, DATE_TIME_OPTIONS) : value;
}

const DURATION_UNITS = [
  { unit: "year", ms: 365 * 24 * 3_600_000 },
  { unit: "month", ms: 30 * 24 * 3_600_000 },
  { unit: "day", ms: 24 * 3_600_000 },
  { unit: "hour", ms: 3_600_000 },
  { unit: "minute", ms: 60_000 },
] as const;

/** A duration in its largest whole unit, such as "10 min" or "3 days"; at least a minute. */
export function formatDuration(ms: number): string {
  const { unit, ms: unitMs } =
    DURATION_UNITS.find((candidate) => ms >= candidate.ms) ?? DURATION_UNITS[4];
  const amount = Math.max(Math.round(ms / unitMs), 1);
  return new Intl.NumberFormat(appLocale(), { style: "unit", unit, unitDisplay: "short" }).format(
    amount
  );
}

// toISOString would shift the day in western timezones.
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Local midnight, so the label never slips a day.
export function parseWireDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

export function formatWireDateShort(isoDate: string): string {
  return format(parseWireDate(isoDate), MONTH_DAY_OPTIONS);
}

/** Month and day of both ends, with the year unless both are in this year. */
export function formatWireDateRange(from: string, to: string): string {
  const start = parseWireDate(from);
  const end = parseWireDate(to);
  const thisYear = new Date().getFullYear();
  const options =
    start.getFullYear() === thisYear && end.getFullYear() === thisYear
      ? MONTH_DAY_OPTIONS
      : SHORT_DATE_OPTIONS;
  return new Intl.DateTimeFormat(appLocale(), options).formatRange(start, end);
}
