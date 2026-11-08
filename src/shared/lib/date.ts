import { appLocale } from "@/shared/lib/locale.ts";

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const MONTH_DAY_OPTIONS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
const TIME_OPTIONS: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

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

export function formatLocalDate(value: string): string {
  return toValidDate(value)?.toLocaleDateString(appLocale()) ?? value;
}

export function formatLocalDateTime(value: string): string {
  return toValidDate(value)?.toLocaleString(appLocale()) ?? value;
}

export function formatShortDateTime(value: string): string {
  const date = toValidDate(value);
  return date ? format(date, DATE_TIME_OPTIONS) : value;
}

export function formatLocalTime(date: Date): string {
  return format(date, TIME_OPTIONS);
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

export function formatLongDate(isoDate: string): string {
  return format(parseWireDate(isoDate), { dateStyle: "long" });
}
