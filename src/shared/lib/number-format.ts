import { appLocale } from "@/shared/lib/locale.ts";

export function formatDecimal(value: number): string {
  return value.toLocaleString(appLocale(), { maximumFractionDigits: 1 });
}

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

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
