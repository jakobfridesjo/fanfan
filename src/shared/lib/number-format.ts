import { appLocale } from "@/shared/lib/locale.ts";

export function formatInteger(value: number): string {
  return value.toLocaleString(appLocale(), { maximumFractionDigits: 0 });
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
