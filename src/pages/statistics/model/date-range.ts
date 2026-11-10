import { toLocalDateString } from "@/shared/lib/date.ts";

/** Calendar days as wire dates (`YYYY-MM-DD`), both included. */
export interface DateRange {
  from: string;
  to: string;
}

const WIRE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The `count` days ending today. */
export function lastDays(count: number, today = new Date()): DateRange {
  const from = new Date(today);
  from.setDate(from.getDate() - (count - 1));
  return { from: toLocalDateString(from), to: toLocalDateString(today) };
}

/** The range in the URL, or the last 30 days when it is missing or malformed. */
export function rangeOrDefault(from: string | undefined, to: string | undefined): DateRange {
  return from && to && WIRE_DATE.test(from) && WIRE_DATE.test(to) && from <= to
    ? { from, to }
    : lastDays(30);
}
