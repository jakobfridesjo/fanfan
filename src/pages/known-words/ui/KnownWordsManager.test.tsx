import { page as screen, userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { makeWordCounts } from "@/shared/test/fixtures.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { callsTo, mockCommands } from "@/shared/test/tauri.ts";
import KnownWordsManager from "@/pages/known-words/ui/KnownWordsManager.tsx";

describe("KnownWordsManager", () => {
  it("shows how many words are known, learning and due", async () => {
    mockCommands({ get_word_counts: () => makeWordCounts({ known: 2500, learning: 80, due: 12 }) });
    await renderPageInRouter(<KnownWordsManager />);

    await expect.element(screen.getByText("2,500")).toBeVisible();
    await expect.element(screen.getByText("80")).toBeVisible();
    await expect.element(screen.getByText("12")).toBeVisible();
  });

  it("marks pasted words as known and clears the box", async () => {
    let counts = makeWordCounts();
    const calls = mockCommands({
      get_word_counts: () => counts,
      import_known_words: () => {
        counts = makeWordCounts({ known: 2 });
        return { found: 3, added: 2 };
      },
    });
    await renderPageInRouter(<KnownWordsManager />);

    const words = screen.getByLabelText("Words");
    await userEvent.fill(words, "你好\tnǐ hǎo\thello\n学习\n中文");
    await screen.getByRole("button", { name: "Mark as known" }).click();

    await expect
      .element(screen.getByText("Marked 2 words as known (1 already known)"))
      .toBeVisible();
    await expect.element(words).toHaveValue("");
    await expect.element(screen.getByText("2", { exact: true })).toBeVisible();
    expect(callsTo(calls, "import_known_words")).toEqual([
      { text: "你好\tnǐ hǎo\thello\n学习\n中文" },
    ]);
  });

  it("only submits text that contains Chinese", async () => {
    mockCommands({ get_word_counts: () => makeWordCounts() });
    await renderPageInRouter(<KnownWordsManager />);

    const submit = screen.getByRole("button", { name: "Mark as known" });
    await expect.element(submit).toBeDisabled();

    await userEvent.fill(screen.getByLabelText("Words"), "hello");
    await userEvent.tab();
    await expect.element(screen.getByText("Paste at least one Chinese word")).toBeVisible();
    await expect.element(submit).toBeDisabled();
  });

  it("loads a word list from a file", async () => {
    mockCommands({ get_word_counts: () => makeWordCounts() });
    await renderPageInRouter(<KnownWordsManager />);

    const file = new File(["北京\n上海\n"], "words.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("Word list file"), file);

    await expect.element(screen.getByLabelText("Words")).toHaveValue("北京\n上海\n");
    await expect.element(screen.getByRole("button", { name: "Mark as known" })).toBeEnabled();
  });

  it("opens the file picker from the Load file button", async () => {
    mockCommands({ get_word_counts: () => makeWordCounts() });
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

  it("keeps the text when the import fails", async () => {
    mockCommands({
      get_word_counts: () => makeWordCounts(),
      import_known_words: () => Promise.reject(new Error("Database error: disk full")),
    });
    await renderPageInRouter(<KnownWordsManager />);

    const words = screen.getByLabelText("Words");
    await userEvent.fill(words, "学习");
    await screen.getByRole("button", { name: "Mark as known" }).click();

    await expect.element(screen.getByText("Database error: disk full")).toBeVisible();
    await expect.element(words).toHaveValue("学习");
  });
});
