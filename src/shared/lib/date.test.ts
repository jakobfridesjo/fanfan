import { describe, expect, it } from "vitest";
import {
  formatLocalDate,
  formatLocalDateTime,
  formatLongDate,
  formatShortDate,
  formatWireDateShort,
  parseWireDate,
  toLocalDateString,
} from "@/shared/lib/date.ts";

describe("date formatters", () => {
  it("uses explicit fallbacks for missing and invalid short dates", () => {
    expect(formatShortDate(null)).toBe("N/A");
    expect(formatShortDate("not-a-date")).toBe("Invalid Date");
  });

  it("preserves invalid source values for local date formats", () => {
    expect(formatLocalDate("not-a-date")).toBe("not-a-date");
    expect(formatLocalDateTime("not-a-date")).toBe("not-a-date");
  });
});

describe("wire dates", () => {
  it("uses the local calendar day rather than the UTC one", () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("parses a wire date as local midnight so it round-trips", () => {
    expect(toLocalDateString(parseWireDate("2026-03-07"))).toBe("2026-03-07");
  });

  it("labels a wire date with month and day, or in full", () => {
    expect(formatWireDateShort("2026-03-07")).toBe("Mar 7");
    expect(formatLongDate("2026-06-30")).toBe("June 30, 2026");
  });
});
