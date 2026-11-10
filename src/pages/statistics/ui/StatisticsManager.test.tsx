import { page as screen, userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { noop } from "@tanstack/react-query";
import type { ReviewDay, Statistics } from "@/shared/api/commands.ts";
import { makeStatistics, makeWordCounts } from "@/shared/test/fixtures.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { callsTo, mockCommands } from "@/shared/test/tauri.ts";
import StatisticsManager from "@/pages/statistics/ui/StatisticsManager.tsx";

const reviewDay = (date: string, counts: Partial<ReviewDay> = {}): ReviewDay => ({
  date,
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
  ...counts,
});

const studied: Statistics = makeStatistics({
  counts: makeWordCounts({ known: 2500, learning: 80, due: 12 }),
  reviewsPerDay: [
    reviewDay("2026-01-09", { again: 1, good: 3 }),
    reviewDay("2026-01-10", { hard: 2, easy: 4 }),
  ],
  dueForecast: [
    { date: "2026-01-10", count: 12 },
    { date: "2026-01-11", count: 5 },
  ],
  stability: [
    { key: "day", count: 3 },
    { key: "week", count: 7 },
  ],
  retention: 0.9,
  streak: 4,
});

const JANUARY = { from: "2026-01-01", to: "2026-01-31" };

describe("StatisticsManager", () => {
  it("shows the headline figures and a chart for each section", async () => {
    mockCommands({ get_statistics: () => studied });
    await renderPageInRouter(<StatisticsManager range={JANUARY} onRangeChange={noop} />);

    const figure = (label: string) => screen.getByRole("group", { name: label, exact: true });
    await expect.element(figure("Known").getByText("2,500", { exact: true })).toBeVisible();
    await expect.element(figure("Due now").getByText("12", { exact: true })).toBeVisible();
    await expect.element(figure("Reviews").getByText("10", { exact: true })).toBeVisible();
    await expect.element(figure("Retention").getByText("90%", { exact: true })).toBeVisible();
    await expect.element(figure("Streak").getByText("4", { exact: true })).toBeVisible();

    for (const chart of [
      "Reviews per day by answer",
      "Learning words due per day",
      "Reviewed words by memory strength",
    ]) {
      await expect.element(screen.getByRole("img", { name: chart })).toBeInTheDocument();
    }
  });

  it("fetches the given range and reports the two days picked in the calendar", async () => {
    const calls = mockCommands({ get_statistics: () => studied });
    const onRangeChange = vi.fn();
    await renderPageInRouter(<StatisticsManager range={JANUARY} onRangeChange={onRangeChange} />);

    await screen.getByRole("button", { name: /^Range: Jan 1/ }).click();
    await screen.getByRole("button", { name: /January 20th, 2026/ }).click();
    expect(onRangeChange).not.toHaveBeenCalled();
    await screen.getByRole("button", { name: /January 10th, 2026/ }).click();

    expect(onRangeChange).toHaveBeenCalledWith({ from: "2026-01-10", to: "2026-01-20" });
    expect(callsTo(calls, "get_statistics")).toEqual([JANUARY]);
  });

  it("explains each empty chart before the first review", async () => {
    mockCommands({ get_statistics: () => makeStatistics() });
    await renderPageInRouter(<StatisticsManager range={JANUARY} onRangeChange={noop} />);

    await expect.element(screen.getByText("No reviews in this range")).toBeVisible();
    await expect.element(screen.getByText("Nothing due in the next 30 days")).toBeVisible();
    await expect.element(screen.getByText("Review a word to see how well it sticks")).toBeVisible();
    await expect
      .element(
        screen
          .getByRole("group", { name: "Retention", exact: true })
          .getByText("—", { exact: true })
      )
      .toBeVisible();
  });

  it("offers a retry when the statistics fail to load", async () => {
    let fail = true;
    mockCommands({
      get_statistics: () => {
        if (fail) throw new Error("database locked");
        return studied;
      },
    });
    await renderPageInRouter(<StatisticsManager range={JANUARY} onRangeChange={noop} />);

    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }).first());

    await expect
      .element(screen.getByRole("img", { name: "Reviews per day by answer" }))
      .toBeInTheDocument();
  });
});
