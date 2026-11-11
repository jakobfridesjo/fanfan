import { appLocale } from "@/shared/lib/locale.ts";

export function formatInteger(value: number): string {
  return value.toLocaleString(appLocale(), { maximumFractionDigits: 0 });
}

export function formatMinutesAsClock(minutes: number): string {
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - wholeMinutes) * 60);
  return `${wholeMinutes}:${String(seconds).padStart(2, "0")}`;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

export function formatDuration(minutes: number): string {
  const totalSeconds = Math.max(0, Math.round(minutes * SECONDS_PER_MINUTE));

  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const remainingMinutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  const join = (primary: string, value: number, unit: string) =>
    value > 0 ? `${primary} ${value} ${unit}` : primary;

  if (days > 0) return join(`${days} d`, hours, "h");
  if (hours > 0) return join(`${hours} h`, remainingMinutes, "min");
  if (remainingMinutes > 0) return join(`${remainingMinutes} min`, seconds, "s");
  return `${seconds} s`;
}

/** A download's size in megabytes, such as "172 MB". */
export function formatMegabytes(bytes: number): string {
  return new Intl.NumberFormat(appLocale(), {
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
    maximumFractionDigits: 0,
  }).format(bytes / 1_000_000);
}

/** A share of a whole, such as "41 %" in Swedish. */
export function formatPercent(part: number, whole: number): string {
  return new Intl.NumberFormat(appLocale(), { style: "percent", maximumFractionDigits: 0 }).format(
    whole > 0 ? Math.min(part / whole, 1) : 0
  );
}
