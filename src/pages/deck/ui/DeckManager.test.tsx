import { page as screen, userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";
import type { StudyCard, WordSnapshot, WordStatus } from "@/shared/api/commands.ts";
import { makeCard, makeDeck, makeDocument } from "@/shared/test/fixtures.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { callsTo, mockCommands } from "@/shared/test/tauri.ts";
import DeckManager from "@/pages/deck/ui/DeckManager.tsx";

/** A deck backed by an in-memory word status table, like the Rust store. */
function mockDeck(cards: StudyCard[], deckOverrides = {}) {
  const statuses = new Map<string, WordStatus>();
  const calls = mockCommands({
    get_deck: () =>
      makeDeck(
        cards.filter((card) => !statuses.has(card.word)),
        deckOverrides
      ),
    set_word_status: ({ word, status }) => {
      const snapshot: WordSnapshot = {
        word: word as string,
        previous: statuses.get(word as string) ?? null,
      };
      statuses.set(word as string, status as WordStatus);
      return snapshot;
    },
    restore_word: ({ snapshot }) => {
      statuses.delete((snapshot as WordSnapshot).word);
      return null;
    },
  });
  return { calls, statuses };
}

describe("DeckManager", () => {
  it("shows the most frequent unsorted word with its context and meaning", async () => {
    mockDeck([
      makeCard("学习", {
        count: 15,
        example: "我们在北京学习中文。",
        readings: [{ pinyin: "xué xí", definitions: ["to learn", "to study"], properNoun: false }],
      }),
      makeCard("中文"),
    ]);
    await renderPageInRouter(<DeckManager documentId={1} />);

    await expect.element(screen.getByText("学习", { exact: true }).first()).toBeVisible();
    await expect.element(screen.getByText("15 times in this book")).toBeVisible();
    await expect.element(screen.getByText("xué xí")).toBeVisible();
    await expect.element(screen.getByText("to learn; to study")).toBeVisible();
  });

  it("states how many words reach 95% and 98% coverage", async () => {
    mockDeck([makeCard("学习")], {
      wordsTo95: 340,
      wordsTo98: 1200,
      document: makeDocument({ title: "三体" }),
    });
    await renderPageInRouter(<DeckManager documentId={1} />);

    await expect
      .element(screen.getByText("340 more words gets you to 95% of the text, 1,200 to 98%."))
      .toBeVisible();
    await expect.element(screen.getByText("三体")).toBeVisible();
  });

  it("sorts words with the buttons and the arrow keys", async () => {
    const { calls } = mockDeck([makeCard("学习"), makeCard("中文"), makeCard("北京")]);
    await renderPageInRouter(<DeckManager documentId={1} />);

    await screen.getByRole("button", { name: "I know it" }).click();
    await expect.element(screen.getByText("中文", { exact: true }).first()).toBeVisible();

    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(screen.getByText("北京", { exact: true }).first()).toBeVisible();

    await screen.getByRole("button", { name: "Learn it" }).click();
    await expect.element(screen.getByText("Every word sorted")).toBeVisible();

    expect(callsTo(calls, "set_word_status")).toEqual([
      { word: "学习", status: "known" },
      { word: "中文", status: "learning" },
      { word: "北京", status: "learning" },
    ]);
  });

  it("undoes the last answer", async () => {
    const { calls } = mockDeck([makeCard("学习"), makeCard("中文")]);
    await renderPageInRouter(<DeckManager documentId={1} />);

    const undo = screen.getByRole("button", { name: "Undo last answer" });
    await expect.element(undo).toBeDisabled();

    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByText("中文", { exact: true }).first()).toBeVisible();

    await undo.click();
    await expect.element(screen.getByText("学习", { exact: true }).first()).toBeVisible();
    await expect.element(undo).toBeDisabled();
    expect(callsTo(calls, "restore_word")).toEqual([
      { snapshot: { word: "学习", previous: null } },
    ]);
  });

  it("undoes with z or Backspace", async () => {
    const { calls } = mockDeck([makeCard("学习"), makeCard("中文"), makeCard("北京")]);
    await renderPageInRouter(<DeckManager documentId={1} />);

    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByText("中文", { exact: true }).first()).toBeVisible();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(screen.getByText("北京", { exact: true }).first()).toBeVisible();

    await userEvent.keyboard("z");
    await expect.element(screen.getByText("中文", { exact: true }).first()).toBeVisible();
    await userEvent.keyboard("{Backspace}");
    await expect.element(screen.getByText("学习", { exact: true }).first()).toBeVisible();
    expect(
      callsTo(calls, "restore_word").map(({ snapshot }) => (snapshot as WordSnapshot).word)
    ).toEqual(["中文", "学习"]);
  });

  it("keeps the undo when restoring fails", async () => {
    mockCommands({
      get_deck: () => makeDeck([makeCard("学习"), makeCard("中文")]),
      set_word_status: ({ word }) => ({ word, previous: null }),
      restore_word: () => Promise.reject(new Error("Database error: locked")),
    });
    await renderPageInRouter(<DeckManager documentId={1} />);

    await screen.getByRole("button", { name: "I know it" }).click();
    const undo = screen.getByRole("button", { name: "Undo last answer" });
    await expect.element(undo).toBeEnabled();
    await undo.click();

    await expect.element(screen.getByText("Database error: locked")).toBeVisible();
    await expect.element(undo).toBeEnabled();
  });

  it("names the last stretch to 98%", async () => {
    mockDeck([makeCard("学习")], { wordsTo95: 0, wordsTo98: 1 });
    await renderPageInRouter(<DeckManager documentId={1} />);

    await expect
      .element(screen.getByText("1 more word gets you to 98% of the text."))
      .toBeVisible();
  });

  it("celebrates a fully sorted book that is 98% covered", async () => {
    mockDeck([], { wordsTo95: 0, wordsTo98: 0 });
    await renderPageInRouter(<DeckManager documentId={1} />);

    await expect
      .element(screen.getByText("You know or are learning 98% of this book's text."))
      .toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Review words" })).toBeVisible();
  });

  it("ignores answers and undo with nothing to act on, and goes back to the library", async () => {
    const { calls } = mockDeck([]);
    const { router } = await renderPageInRouter(<DeckManager documentId={1} />, {
      initialPath: "/library/1",
    });

    await expect.element(screen.getByText("Every word sorted")).toBeVisible();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("z");
    expect(callsTo(calls, "set_word_status")).toEqual([]);
    expect(callsTo(calls, "restore_word")).toEqual([]);

    await screen.getByRole("button", { name: "Back to library" }).click();
    await expect.poll(() => router.state.location.pathname).toBe("/library");
  });

  it("puts the word back when saving the answer fails", async () => {
    mockCommands({
      get_deck: () => makeDeck([makeCard("学习")]),
      set_word_status: () => Promise.reject(new Error("Database error: disk full")),
    });
    await renderPageInRouter(<DeckManager documentId={1} />);

    await screen.getByRole("button", { name: "I know it" }).click();
    await expect.element(screen.getByText("Database error: disk full")).toBeVisible();
    await expect.element(screen.getByText("学习", { exact: true }).first()).toBeVisible();
  });

  it("says when the deck cannot be loaded", async () => {
    mockCommands({ get_deck: () => Promise.reject(new Error("Document 5 does not exist")) });
    await renderPageInRouter(<DeckManager documentId={5} />);

    await expect.element(screen.getByText("This book's words could not be loaded.")).toBeVisible();
  });
});
