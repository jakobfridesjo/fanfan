import { describe, expect, it } from "vitest";
import { lastDays, rangeOrDefault } from "@/pages/statistics/model/date-range.ts";

describe("date ranges", () => {
  it("ends the last days today", () => {
    expect(lastDays(7, new Date(2026, 0, 3))).toEqual({ from: "2025-12-28", to: "2026-01-03" });
  });

  it("falls back to the last 30 days for a missing, malformed or reversed range", () => {
    expect(rangeOrDefault("2026-01-01", "2026-01-31")).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
    for (const [from, to] of [
      [undefined, "2026-01-31"],
      ["January", "2026-01-31"],
      ["2026-02-01", "2026-01-31"],
    ]) {
      expect(rangeOrDefault(from, to)).toEqual(lastDays(30));
    }
  });
});
