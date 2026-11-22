import { describe, expect, it } from "vitest";
import type { PrepareProgress } from "@/shared/api/commands.ts";
import { fractionDone, timeLeft } from "@/features/book-audio/model/progress.ts";

const progress = (overrides: Partial<PrepareProgress>): PrepareProgress => ({
  section: 0,
  sectionsDone: 0,
  sectionsTotal: 4,
  phrasesDone: 0,
  phrasesTotal: 10,
  waiting: false,
  ...overrides,
});

describe("fractionDone", () => {
  it("counts finished sections and the phrases of the current one", () => {
    expect(fractionDone(progress({ sectionsDone: 1, phrasesDone: 5 }))).toBe(0.375);
    expect(fractionDone(progress({ sectionsDone: 2, phrasesTotal: 0 }))).toBe(0.5);
  });
});

describe("timeLeft", () => {
  const timing = { section: 1, fraction: 0.25, at: 0 };

  it("waits until a chapter has been timed in this run", () => {
    expect(
      timeLeft(progress({ section: 1, sectionsDone: 1, phrasesDone: 9 }), timing, 60_000)
    ).toBe(null);
    expect(timeLeft(null, null, 0)).toBe(null);
  });

  it("goes by the speed since the run's first report", () => {
    // A quarter of the book in a minute, with half of it left.
    expect(timeLeft(progress({ section: 2, sectionsDone: 2 }), timing, 60_000)).toBe(120_000);
  });
});
