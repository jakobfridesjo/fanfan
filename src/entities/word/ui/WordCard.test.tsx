import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { render as renderInPage } from "vitest-browser-react";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { makeCard, silentOpus } from "@/shared/test/fixtures.ts";
import { createTestQueryClient } from "@/shared/test/query.tsx";
import { callsTo, mockCommands } from "@/shared/test/tauri.ts";
import { Toaster } from "@/shared/ui/Toaster.tsx";
import { WordCard } from "@/entities/word/ui/WordCard.tsx";

function render(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return renderInPage(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    ),
  });
}

describe("WordCard", () => {
  it("highlights the word in its example and counts a single use", async () => {
    await render(<WordCard card={makeCard("北京", { count: 1, example: "我们在北京学习。" })} />);

    await expect.element(page.getByText("Once in this book")).toBeVisible();
    await expect.element(page.getByRole("mark")).toHaveTextContent("北京");
  });

  it("shows the word in the chosen script and speaks the stored one", async () => {
    const calls = mockCommands({ speak: () => silentOpus() });
    await render(
      <WordCard card={makeCard("学习", { displayWord: "學習", example: "我們學習中文。" })} />
    );

    await expect.element(page.getByRole("mark")).toHaveTextContent("學習");
    await page.getByRole("button", { name: "Play pronunciation" }).click();
    await expect.poll(() => callsTo(calls, "speak")).toEqual([{ text: "学习" }]);
  });

  it("shows an example that lacks the word as is, and no count outside a book", async () => {
    await render(
      <WordCard card={makeCard("學習", { count: null, example: "我们在北京学习。" })} />
    );

    await expect.element(page.getByText("我们在北京学习。")).toBeVisible();
    await expect.element(page.getByRole("mark")).not.toBeInTheDocument();
    await expect.element(page.getByText(/in this book/)).not.toBeInTheDocument();
  });

  it("hides the meaning for recall until asked", async () => {
    const onReveal = vi.fn();
    await render(<WordCard card={makeCard("学习")} hidden onReveal={onReveal} />);

    await expect.element(page.getByText("学习-pinyin")).not.toBeInTheDocument();
    await page.getByRole("button", { name: "Show meaning" }).click();
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("speaks the word, synthesizing it only once", async () => {
    const calls = mockCommands({ speak: () => silentOpus() });
    await render(<WordCard card={makeCard("学习")} />);

    const play = page.getByRole("button", { name: "Play pronunciation" });
    await play.click();
    await play.click();

    await expect.poll(() => callsTo(calls, "speak")).toEqual([{ text: "学习" }]);
    await expect.poll(() => document.querySelectorAll("[data-sonner-toast]").length).toBe(0);
  });

  it("says when the word cannot be spoken", async () => {
    mockCommands({
      speak: () => Promise.reject(new Error("Could not play the word: voice missing")),
    });
    await render(<WordCard card={makeCard("学习")} />);

    await page.getByRole("button", { name: "Play pronunciation" }).click();

    await expect.element(page.getByText("Could not play the word: voice missing")).toBeVisible();
  });

  it("lists every reading, marks names, and says when the dictionary has nothing", async () => {
    const { rerender } = await render(
      <WordCard
        card={makeCard("明", {
          example: "",
          readings: [
            {
              pinyin: "míng",
              definitions: ["bright", "clear", "open", "honest", "next"],
              properNoun: false,
            },
            { pinyin: "Míng", definitions: ["Ming dynasty"], properNoun: true },
          ],
        })}
      />
    );

    await expect.element(page.getByText("bright; clear; open; honest")).toBeVisible();
    await expect.element(page.getByText("Name")).toBeVisible();
    await expect.element(page.getByText("Ming dynasty")).toBeVisible();

    await rerender(<WordCard card={makeCard("𠀀", { readings: [] })} />);
    await expect.element(page.getByText("No dictionary entry")).toBeVisible();
  });
});
