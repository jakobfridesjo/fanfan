import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { render as renderInPage } from "vitest-browser-react";
import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { shownExamsAtom, shownNotationsAtom } from "@/shared/config/preferences.ts";
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
  it("shows the exam levels the settings ask for", async () => {
    await render(<WordCard card={makeCard("学习", { hskLevel: 7, tbclLevel: 2 })} />);

    const levels = page.getByRole("list", { name: "Exam levels" });
    await expect.element(levels).toHaveTextContent("HSK 7–9TBCL 2");

    shownExamsAtom.set(["tbcl"]);
    await expect.element(levels).toHaveTextContent("TBCL 2");
    shownExamsAtom.set([]);
    await expect.element(levels).not.toBeInTheDocument();
  });

  it("shows pinyin, zhuyin and Cangjie codes each as the settings turn them on", async () => {
    await render(
      <WordCard
        card={makeCard("學習", {
          cangjie: "HBND SMHA",
          readings: [
            {
              pinyin: "xué xí",
              zhuyin: "ㄒㄩㄝˊ ㄒㄧˊ",
              definitions: ["to learn"],
              properNoun: false,
            },
          ],
        })}
      />
    );

    await expect.element(page.getByText("xué xí")).toBeVisible();
    await expect.element(page.getByText("ㄒㄩㄝˊ ㄒㄧˊ")).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("group", { name: "Cangjie codes" }))
      .not.toBeInTheDocument();

    shownNotationsAtom.set(["zhuyin", "cangjie"]);
    await expect.element(page.getByText("ㄒㄩㄝˊ ㄒㄧˊ")).toBeVisible();
    await expect.element(page.getByText("xué xí")).not.toBeInTheDocument();
    await expect.element(page.getByText("竹月弓木 尸一竹日")).toBeVisible();
    await expect.element(page.getByText("HBND SMHA")).toBeVisible();

    shownNotationsAtom.set([]);
    await expect.element(page.getByText("ㄒㄩㄝˊ ㄒㄧˊ")).not.toBeInTheDocument();
    await expect.element(page.getByText("to learn")).toBeVisible();
  });

  it("gives each form its own Cangjie codes when both scripts are shown", async () => {
    shownNotationsAtom.set(["cangjie"]);
    await render(
      <WordCard
        card={makeCard("学习", {
          alternateWord: "學習",
          cangjie: "FBND SIM",
          alternateCangjie: "HBND SMHA",
        })}
      />
    );

    const codes = page.getByRole("group", { name: "Cangjie codes" });
    await expect
      .element(codes)
      .toHaveTextContent("学习火月弓木 尸戈一FBND SIM學習竹月弓木 尸一竹日HBND SMHA");
  });

  it("shows the traditional form beside the word when both scripts are shown", async () => {
    await render(<WordCard card={makeCard("学习", { alternateWord: "學習" })} />);

    await expect.element(page.getByText("学习/學習", { exact: true })).toBeVisible();
  });

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
    await expect.poll(() => callsTo(calls, "speak")).toEqual([{ text: "学习", speaker: "lingyu" }]);
  });

  it("shows an example that lacks the word as is, and no count outside a book", async () => {
    await render(
      <WordCard card={makeCard("學習", { count: null, example: "我们在北京学习。" })} />
    );

    await expect.element(page.getByText("我们在北京学习。")).toBeVisible();
    await expect.element(page.getByRole("mark")).not.toBeInTheDocument();
    await expect.element(page.getByText(/in this book/)).not.toBeInTheDocument();
  });

  it("hides the meaning for recall", async () => {
    await render(<WordCard card={makeCard("学习")} hidden />);

    await expect.element(page.getByText("学习-pinyin")).not.toBeVisible();
  });

  it("speaks the word, synthesizing it only once", async () => {
    const calls = mockCommands({ speak: () => silentOpus() });
    await render(<WordCard card={makeCard("学习")} />);

    const play = page.getByRole("button", { name: "Play pronunciation" });
    await play.click();
    await play.click();

    await expect.poll(() => callsTo(calls, "speak")).toEqual([{ text: "学习", speaker: "lingyu" }]);
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
              zhuyin: "ㄇㄧㄥˊ",
              definitions: ["bright", "clear", "open", "honest", "next"],
              properNoun: false,
            },
            { pinyin: "Míng", zhuyin: "ㄇㄧㄥˊ", definitions: ["Ming dynasty"], properNoun: true },
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
