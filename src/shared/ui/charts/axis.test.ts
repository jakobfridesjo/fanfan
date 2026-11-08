import { describe, expect, it } from "vitest";
import { countAxis, evenlySpaced, formatDateTick, integerTicks } from "@/shared/ui/charts/axis.ts";

describe("formatDateTick", () => {
  it("labels a week by weekday and a month by day number", () => {
    expect(formatDateTick("2026-03-02", 7)).toBe("Mon");
    expect(formatDateTick("2026-03-02", 30)).toBe("2");
    expect(formatDateTick("2026-03-02", 90)).toBe("Mar 2");
  });
});

describe("integerTicks", () => {
  it("never produces fractional ticks for small counts", () => {
    expect(integerTicks(0)).toEqual([0, 1]);
    expect(integerTicks(1)).toEqual([0, 1]);
    expect(integerTicks(3)).toEqual([0, 1, 2, 3]);
    expect(integerTicks(5)).toEqual([0, 2, 4, 6]);
  });

  it("rounds larger ranges to 1, 2 and 5 multiples that cover the maximum", () => {
    expect(integerTicks(13)).toEqual([0, 5, 10, 15]);
    expect(integerTicks(100)).toEqual([0, 50, 100]);
    expect(integerTicks(1234)).toEqual([0, 500, 1000, 1500]);
  });
});

describe("countAxis", () => {
  it("ends the domain on the last tick", () => {
    const axis = countAxis(13);
    expect(axis.scale.domain()).toEqual([0, 15]);
    expect(axis.values).toEqual([0, 5, 10, 15]);
  });
});

describe("evenlySpaced", () => {
  it("keeps every value that fits and thins the rest to a regular step", () => {
    const days = Array.from({ length: 30 }, (_, index) => index);
    expect(evenlySpaced(days.slice(0, 5), 320)).toEqual([0, 1, 2, 3, 4]);
    expect(evenlySpaced(days, 320)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27]);
  });
});
