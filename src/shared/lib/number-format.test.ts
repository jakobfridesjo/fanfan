import { describe, expect, it } from "vitest";
import { formatDuration, formatMinutesAsClock } from "@/shared/lib/number-format.ts";

describe("duration formatting", () => {
  it("renders an average as M:SS", () => {
    expect(formatMinutesAsClock(7.5)).toBe("7:30");
    expect(formatMinutesAsClock(0.05)).toBe("0:03");
  });

  it("renders a total in its two largest units", () => {
    expect(formatDuration(0.5)).toBe("30 s");
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(60 * 25)).toBe("1 d 1 h");
    expect(formatDuration(120)).toBe("2 h");
  });
});
