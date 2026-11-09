import { page as screen } from "vitest/browser";
import { describe, expect, it } from "vitest";
import type { WordStatus } from "@/shared/api/commands.ts";
import { makeCard, makeDocument, makeSection, silentOpus } from "@/shared/test/fixtures.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { callsTo, mockCommands } from "@/shared/test/tauri.ts";
import ReaderManager from "@/pages/reader/ui/ReaderManager.tsx";

const SECTIONS = [["序言 很 短 。"], ["我们 学习 中文 。", "中文 很 好 ！"], ["第二章 。"]];

/** A book backed by an in-memory word status table, like the Rust store. */
function mockBook({ readingSection = 0, known = [] as string[], learning = [] as string[] } = {}) {
  const statuses = new Map<string, WordStatus>([
    ...known.map((word): [string, WordStatus] => [word, "known"]),
    ...learning.map((word): [string, WordStatus] => [word, "learning"]),
  ]);
  const calls = mockCommands({
    list_documents: () => [makeDocument({ id: 1, title: "三体", readingSection })],
    list_sections: () => [null, "第一章", "第二章"],
    get_section: ({ position }) =>
      makeSection(SECTIONS[position as number] ?? [], { position: position as number }),
    get_word_statuses: ({ words }) =>
      Object.fromEntries(
        (words as string[]).flatMap((word) => {
          const status = statuses.get(word);
          return status ? [[word, status]] : [];
        })
      ),
    get_word_card: ({ word }) =>
      makeCard(word as string, {
        count: null,
        readings: [
          {
            pinyin: "Zhōng wén",
            zhuyin: "ㄓㄨㄥ ㄨㄣˊ",
            definitions: ["Chinese language"],
            properNoun: false,
          },
        ],
      }),
    set_word_status: ({ word, status }) => {
      statuses.set(word as string, status as WordStatus);
      return { word, previous: null };
    },
    mark_words_known: ({ words }) => {
      for (const word of words as string[]) statuses.set(word, "known");
      return (words as string[]).length;
    },
    set_reading_position: () => null,
    // The last paragraph never finishes synthesizing, so playback stays on it.
    speak: ({ text }) => (text === "中文很好！" ? new Promise(() => {}) : silentOpus()),
  });
  return { calls, statuses };
}

const word = (text: string) => screen.getByRole("button", { name: text, exact: true }).first();

const spoken = () =>
  [...document.querySelectorAll("[data-spoken]")].map((token) => token.textContent).join("");

describe("ReaderManager", () => {
  it("reads aloud from the selected word's phrase, underlining what it speaks", async () => {
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await word("学习").click();
    await screen.getByRole("button", { name: "Read aloud from the selected word" }).click();

    await expect.poll(spoken).toBe("中文很好！");
    expect(callsTo(calls, "speak")).toEqual([{ text: "我们学习中文。" }, { text: "中文很好！" }]);

    await screen.getByRole("button", { name: "Pause reading" }).click();
    await screen.getByRole("button", { name: "Resume reading" }).click();
    await screen.getByRole("button", { name: "Stop reading" }).click();
    await expect.poll(spoken).toBe("");
    await expect
      .element(screen.getByRole("button", { name: "Read aloud from the selected word" }))
      .toBeVisible();
  });

  it("restarts a paused reading from a newly selected word", async () => {
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await word("好").click();
    await screen.getByRole("button", { name: "Read aloud from the selected word" }).click();
    await expect.poll(spoken).toBe("中文很好！");
    await screen.getByRole("button", { name: "Pause reading" }).click();

    await word("我们").click();
    await screen.getByRole("button", { name: "Read aloud from the selected word" }).click();
    await expect.poll(() => callsTo(calls, "speak")[1]).toEqual({ text: "我们学习中文。" });
  });

  it("opens the book where it was left and colours words by status", async () => {
    const { calls } = mockBook({ readingSection: 1, known: ["我们"], learning: ["学习"] });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("学习")).toHaveAttribute("data-status", "learning");
    await expect.element(word("我们")).toHaveAttribute("data-status", "known");
    await expect.element(word("中文")).toHaveAttribute("data-status", "unseen");
    await expect.element(screen.getByText("三体")).toBeVisible();
    expect(callsTo(calls, "get_section")).toEqual([
      { documentId: 1, position: 1, script: "simplified" },
    ]);
  });

  it("looks up a selected word and sorts it", async () => {
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(screen.getByText(/Select a word in the text/)).toBeVisible();
    await word("中文").click();
    await expect.element(screen.getByText("Zhōng wén")).toBeVisible();
    await expect.element(screen.getByText("Chinese language")).toBeVisible();

    await screen.getByRole("button", { name: "Learn it" }).click();
    await expect.element(word("中文")).toHaveAttribute("data-status", "learning");
    await expect.element(screen.getByRole("button", { name: "Learn it" })).toBeDisabled();
    expect(callsTo(calls, "set_word_status")).toEqual([{ word: "中文", status: "learning" }]);
  });

  it("marks the chapter's new words known after confirming", async () => {
    const { calls } = mockBook({ readingSection: 1, known: ["我们", "很"] });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("学习")).toHaveAttribute("data-status", "unseen");
    await screen.getByRole("button", { name: "Mark new words as known" }).click();
    await expect.element(screen.getByText(/Mark the 3 new words in this chapter/)).toBeVisible();
    await screen.getByRole("button", { name: "Mark as known" }).click();

    await expect.element(screen.getByText("Marked 3 words as known")).toBeVisible();
    await expect.element(word("学习")).toHaveAttribute("data-status", "known");
    expect(callsTo(calls, "mark_words_known")).toEqual([{ words: ["学习", "中文", "好"] }]);
  });

  it("moves to the next chapter and remembers it", async () => {
    const { calls } = mockBook();
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("序言")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Previous chapter" })).toBeDisabled();
    await screen.getByRole("button", { name: "Next chapter" }).click();

    await expect.element(word("我们")).toBeVisible();
    expect(callsTo(calls, "set_reading_position")).toContainEqual({
      documentId: 1,
      section: 1,
      paragraph: 0,
    });
  });

  it("renders the paragraphs scrolled into view", async () => {
    const paragraphs = Array.from({ length: 300 }, (_, index) => `段落${index} 。`);
    mockCommands({
      list_documents: () => [makeDocument({ id: 1, readingSection: 0 })],
      list_sections: () => ["第一章"],
      get_section: () => makeSection(paragraphs),
      get_word_statuses: () => ({}),
      set_reading_position: () => null,
    });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    const text = screen.getByTestId("reader-text");
    await expect.element(word("段落0")).toBeInTheDocument();
    text.element().setAttribute("style", "height: 20rem; flex: none");
    text.element().scrollTop = text.element().scrollHeight;

    await expect.element(word("段落299")).toBeInTheDocument();
    await expect.element(word("段落0")).not.toBeInTheDocument();
  });
});
