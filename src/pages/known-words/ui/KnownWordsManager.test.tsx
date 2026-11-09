import { page as screen, userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";
import type { WordEntry, WordStatus } from "@/shared/api/commands.ts";
import { shownExamsAtom } from "@/shared/config/preferences.ts";
import { makeWordEntry } from "@/shared/test/fixtures.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { callsTo, mockCommands } from "@/shared/test/tauri.ts";
import KnownWordsManager from "@/pages/known-words/ui/KnownWordsManager.tsx";

const HOUR = 60 * 60 * 1000;

/** `list_words` over a word → status map that `set_word_status` and `restore_word` change. */
function wordStore(initial: Record<string, WordStatus>) {
  const statuses = new Map(Object.entries(initial));
  const entry = (word: string, status: WordStatus): WordEntry =>
    makeWordEntry(word, {
      status,
      dueAt: status === "learning" ? Date.now() + 48 * HOUR : null,
    });
  return {
    list_words: () => [...statuses].map(([word, status]) => entry(word, status)),
    set_word_status: ({ word, status }: Record<string, unknown>) => {
      const previous = statuses.get(word as string);
      statuses.set(word as string, status as WordStatus);
      return { word, previous: previous ?? null };
    },
    restore_word: ({ snapshot }: Record<string, unknown>) => {
      const { word, previous } = snapshot as { word: string; previous: WordStatus };
      statuses.set(word, previous);
      return null;
    },
  };
}

const bodyRows = () => screen.getByRole("row").all().slice(1);

describe("KnownWordsManager", () => {
  it("lists known and learning words with their pinyin and meaning", async () => {
    mockCommands({
      list_words: () => [
        makeWordEntry("你好", {
          readings: [{ pinyin: "nǐ hǎo", definitions: ["hello", "hi"], properNoun: false }],
        }),
        makeWordEntry("学习", { status: "learning", dueAt: Date.now() - HOUR }),
      ],
    });
    await renderPageInRouter(<KnownWordsManager />);

    await expect.element(screen.getByRole("cell", { name: "你好" })).toBeVisible();
    await expect.element(screen.getByText("nǐ hǎo")).toBeVisible();
    await expect.element(screen.getByText("hello; hi")).toBeVisible();
    await expect.element(screen.getByText("Due now")).toBeVisible();
    await expect.element(screen.getByRole("cell", { name: "Learning" })).toBeVisible();
  });

  it("shows and sorts by exam level, and drops the column when no exam is shown", async () => {
    mockCommands({
      list_words: () => [
        makeWordEntry("阿拉伯语", { hskLevel: 7 }),
        makeWordEntry("北京大学生"),
        makeWordEntry("学习", { hskLevel: 1, tocflLevel: "beginner" }),
      ],
    });
    await renderPageInRouter(<KnownWordsManager />);

    await expect.element(screen.getByText("TOCFL Beginner")).toBeVisible();
    await screen.getByRole("button", { name: "Sort ascending by Level" }).click();
    await expect
      .poll(() => bodyRows().map((row) => row.element().textContent))
      .toEqual([
        expect.stringContaining("HSK 1TOCFL Beginner"),
        expect.stringContaining("HSK 7–9"),
        expect.not.stringContaining("HSK"),
      ]);

    shownExamsAtom.set([]);
    await expect.element(screen.getByText("HSK 7–9")).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("columnheader", { name: "Level" }))
      .not.toBeInTheDocument();
  });

  it("searches pinyin without tone marks and filters by status", async () => {
    mockCommands({
      list_words: () => [
        makeWordEntry("你好", {
          readings: [{ pinyin: "nǐ hǎo", definitions: ["hello"], properNoun: false }],
        }),
        makeWordEntry("学习", { status: "learning" }),
        makeWordEntry("中文"),
      ],
    });
    await renderPageInRouter(<KnownWordsManager />);
    await expect.element(screen.getByRole("cell", { name: "中文" })).toBeVisible();

    await userEvent.fill(screen.getByPlaceholder("Search words, pinyin or meanings"), "nihao");
    await expect.poll(() => bodyRows().length).toBe(1);
    await expect.element(screen.getByRole("cell", { name: "你好" })).toBeVisible();

    await userEvent.clear(screen.getByPlaceholder("Search words, pinyin or meanings"));
    await expect.poll(() => bodyRows().length).toBe(3);

    await screen.getByRole("combobox", { name: "Status" }).click();
    await screen.getByRole("option", { name: "Learning (1)" }).click();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => bodyRows().length).toBe(1);
    await expect.element(screen.getByRole("cell", { name: "学习" })).toBeVisible();
  });

  it("starts learning a known word and undoes it from the toast", async () => {
    const calls = mockCommands(wordStore({ 学习: "known" }));
    await renderPageInRouter(<KnownWordsManager />);

    await screen.getByRole("button", { name: "Start learning: 学习" }).click();
    await expect.element(screen.getByText("Started learning “学习”")).toBeVisible();
    await expect.element(screen.getByRole("cell", { name: "Learning" })).toBeVisible();
    expect(callsTo(calls, "set_word_status")).toEqual([{ word: "学习", status: "learning" }]);

    await screen.getByRole("button", { name: "Undo" }).click();
    await expect.element(screen.getByRole("cell", { name: "Known" })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Start learning: 学习" }))
      .toBeVisible();
  });

  it("marks every word in a loaded file as known", async () => {
    let listed: WordEntry[] = [];
    const calls = mockCommands({
      list_words: () => listed,
      import_known_words: () => {
        listed = [makeWordEntry("北京"), makeWordEntry("上海")];
        return { found: 3, added: 2 };
      },
    });
    await renderPageInRouter(<KnownWordsManager />);
    await expect
      .element(screen.getByText("No words yet. Load a word list, or sort a book's deck."))
      .toBeVisible();

    const file = new File(["北京\n上海\n中文\n"], "words.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("Word list file"), file);

    await expect
      .element(screen.getByText("Marked 2 words as known (1 already known)"))
      .toBeVisible();
    await expect.element(screen.getByRole("cell", { name: "北京" })).toBeVisible();
    expect(callsTo(calls, "import_known_words")).toEqual([{ text: "北京\n上海\n中文\n" }]);
  });

  it("opens the file picker from the Load file button", async () => {
    mockCommands({ list_words: () => [] });
    await renderPageInRouter(<KnownWordsManager />);

    const input = screen.getByLabelText("Word list file").element() as HTMLInputElement;
    const opened = new Promise<void>((resolve) => {
      input.addEventListener("click", (event) => {
        event.preventDefault();
        resolve();
      });
    });
    await screen.getByRole("button", { name: "Load file" }).click();
    await expect(opened).resolves.toBeUndefined();
  });

  it("reports a file without Chinese words and a failed import", async () => {
    let fail = false;
    mockCommands({
      list_words: () => [],
      import_known_words: () =>
        fail ? Promise.reject(new Error("Database error: disk full")) : { found: 0, added: 0 },
    });
    await renderPageInRouter(<KnownWordsManager />);
    const input = screen.getByLabelText("Word list file");

    await userEvent.upload(input, new File(["hello"], "english.txt", { type: "text/plain" }));
    await expect.element(screen.getByText("No Chinese words in english.txt")).toBeVisible();

    fail = true;
    await userEvent.upload(input, new File(["学习"], "words.txt", { type: "text/plain" }));
    await expect.element(screen.getByText("Database error: disk full")).toBeVisible();
  });
});
