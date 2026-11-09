import { page as screen, userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";
import type { ReviewSnapshot, StudyCard } from "@/shared/api/commands.ts";
import { makeCard, makeReviewQueue, makeReviewSnapshot } from "@/shared/test/fixtures.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { dragHorizontally } from "@/shared/test/pointer.ts";
import { callsTo, mockCommands } from "@/shared/test/tauri.ts";
import ReviewManager from "@/pages/review/ui/ReviewManager.tsx";

function mockQueue(cards: StudyCard[]) {
  const reviewed = new Set<string>();
  return mockCommands({
    get_review_queue: () => makeReviewQueue(cards.filter((card) => !reviewed.has(card.word))),
    review_word: ({ word }) => {
      reviewed.add(word as string);
      return makeReviewSnapshot(word as string);
    },
    undo_review: ({ snapshot }) => {
      reviewed.delete((snapshot as ReviewSnapshot).word.word);
      return null;
    },
  });
}

describe("ReviewManager", () => {
  it("asks for recall before showing the answer and the ratings", async () => {
    mockQueue([
      makeCard("学习", {
        count: null,
        readings: [
          {
            pinyin: "xué xí",
            zhuyin: "ㄒㄩㄝˊ ㄒㄧˊ",
            definitions: ["to learn"],
            properNoun: false,
          },
        ],
      }),
    ]);
    await renderPageInRouter(<ReviewManager />);

    await expect.element(screen.getByText("1 card due")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /^Good/ })).not.toBeInTheDocument();

    await expect.element(screen.getByText("Tap the card to show the meaning")).toBeVisible();
    await screen.getByRole("button", { name: "Show answer" }).click();
    await expect.element(screen.getByText("xué xí")).toBeVisible();
    for (const [rating, interval] of [
      ["Again", "10 min"],
      ["Hard", "1 day"],
      ["Good", "3 days"],
      ["Easy", "8 days"],
    ]) {
      await expect
        .element(screen.getByRole("button", { name: `${rating} ${interval}` }))
        .toBeVisible();
    }
  });

  it("undoes the last rating and asks for that card again", async () => {
    const calls = mockQueue([makeCard("学习"), makeCard("中文")]);
    await renderPageInRouter(<ReviewManager />);

    const undo = screen.getByRole("button", { name: "Undo last rating" });
    await expect.element(undo).toBeDisabled();

    await userEvent.keyboard(" ");
    await userEvent.keyboard("3");
    await expect.element(screen.getByText("中文", { exact: true }).first()).toBeVisible();
    await userEvent.keyboard(" ");
    await userEvent.keyboard("{Backspace}");

    await expect.element(screen.getByText("学习", { exact: true }).first()).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Show answer" })).toBeVisible();
    await expect.element(undo).toBeDisabled();
    expect(callsTo(calls, "undo_review")).toEqual([{ snapshot: makeReviewSnapshot("学习") }]);
  });

  it("rates cards with buttons and keys until the queue is empty", async () => {
    const calls = mockQueue([makeCard("学习"), makeCard("中文"), makeCard("北京")]);
    await renderPageInRouter(<ReviewManager />);

    await screen.getByRole("button", { name: "Show answer" }).click();
    await screen.getByRole("button", { name: /^Easy/ }).click();
    await expect.element(screen.getByText("中文", { exact: true }).first()).toBeVisible();

    // Rating keys do nothing until the answer shows.
    await userEvent.keyboard("1");
    await userEvent.keyboard(" ");
    await userEvent.keyboard("1");
    await expect.element(screen.getByText("北京", { exact: true }).first()).toBeVisible();

    await userEvent.keyboard(" ");
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByText("Nothing to review")).toBeVisible();

    expect(callsTo(calls, "review_word")).toEqual([
      { word: "学习", rating: 4 },
      { word: "中文", rating: 1 },
      { word: "北京", rating: 3 },
    ]);
  });

  it("rates hard and easy from the keyboard after Enter reveals", async () => {
    const calls = mockQueue([makeCard("学习"), makeCard("中文")]);
    await renderPageInRouter(<ReviewManager />);

    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("2");
    await expect.element(screen.getByText("中文", { exact: true }).first()).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("4");
    await expect.element(screen.getByText("Nothing to review")).toBeVisible();

    expect(callsTo(calls, "review_word")).toEqual([
      { word: "学习", rating: 2 },
      { word: "中文", rating: 4 },
    ]);
  });

  it("rates good and again with the arrow keys, the 3 key and a swipe", async () => {
    const calls = mockQueue([makeCard("学习"), makeCard("中文"), makeCard("北京")]);
    await renderPageInRouter(<ReviewManager />);

    await userEvent.keyboard(" ");
    await userEvent.keyboard("3");
    await expect.element(screen.getByText("中文", { exact: true }).first()).toBeVisible();
    await userEvent.keyboard(" ");
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(screen.getByText("北京", { exact: true }).first()).toBeVisible();

    await userEvent.keyboard(" ");
    const card = screen.getByText("北京", { exact: true }).first().element();
    await dragHorizontally(card, 260);
    await expect.element(screen.getByText("Nothing to review")).toBeVisible();

    expect(callsTo(calls, "review_word")).toEqual([
      { word: "学习", rating: 3 },
      { word: "中文", rating: 1 },
      { word: "北京", rating: 3 },
    ]);
  });

  it("brings the card back when saving the review fails", async () => {
    mockCommands({
      get_review_queue: () => makeReviewQueue([makeCard("学习")]),
      review_word: () => Promise.reject(new Error('"学习" is not being learned')),
    });
    await renderPageInRouter(<ReviewManager />);

    await userEvent.keyboard(" ");
    await screen.getByRole("button", { name: /^Good/ }).click();
    await expect.element(screen.getByText('"学习" is not being learned')).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Show answer" })).toBeVisible();
  });

  it("says when the reviews cannot be loaded", async () => {
    mockCommands({ get_review_queue: () => Promise.reject(new Error("Database error")) });
    await renderPageInRouter(<ReviewManager />);

    await expect.element(screen.getByText("Your reviews could not be loaded.")).toBeVisible();
  });

  it("says when the next card comes due", async () => {
    mockCommands({
      get_review_queue: () => makeReviewQueue([], { nextDueAt: Date.UTC(2030, 4, 6, 9, 30) }),
    });
    await renderPageInRouter(<ReviewManager />);

    await expect.element(screen.getByText(/^Next review: May 6, 2030/)).toBeVisible();
  });

  it("explains how to start when nothing is being learned", async () => {
    mockCommands({ get_review_queue: () => makeReviewQueue([]) });
    await renderPageInRouter(<ReviewManager />);

    await expect
      .element(screen.getByText("Swipe words left in a book's deck to start learning them."))
      .toBeVisible();
  });
});
