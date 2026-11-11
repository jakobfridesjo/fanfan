import { page, page as screen, userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelStatus, WordStatus } from "@/shared/api/commands.ts";
import { readerNotationAtom } from "@/shared/config/preferences.ts";
import { makeCard, makeDocument, makeSection, silentOpus } from "@/shared/test/fixtures.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { callsTo, mockCommands, sendToChannel } from "@/shared/test/tauri.ts";
import ReaderManager from "@/pages/reader/ui/ReaderManager.tsx";

const SECTIONS = [["序言 很 短 。"], ["我们 学习 中文 。", "中文 很 好 ！"], ["第二章 。"]];

interface BookOptions {
  readingSection?: number;
  known?: string[];
  learning?: string[];
  /** What `list_models` answers; none means nothing is downloadable. */
  models?: ModelStatus[];
  download?: (args: Record<string, unknown>) => unknown;
}

/** A book backed by an in-memory word status table, like the Rust store. */
function mockBook({
  readingSection = 0,
  known = [],
  learning = [],
  models = [],
  download = () => true,
}: BookOptions = {}) {
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
    set_reading_position: () => null,
    // The last paragraph never finishes synthesizing, so playback stays on it.
    speak: ({ text }) => (text === "中文很好！" ? new Promise(() => {}) : silentOpus()),
    translate: ({ text }) => `In English: ${text as string}`,
    list_models: () => models.map((entry) => ({ ...entry })),
    download_model: download,
  });
  return { calls, statuses };
}

const word = (text: string) => screen.getByRole("button", { name: text, exact: true }).first();

const spoken = () =>
  [...document.querySelectorAll("[data-spoken]")].map((token) => token.textContent).join("");

/** Presses on `from`, drags to `to` and lets go, holding still first unless `hold` is false. */
async function drag(
  from: Element,
  to: Element,
  { pointerType = "mouse", hold = true }: { pointerType?: "mouse" | "touch"; hold?: boolean } = {}
) {
  const pointer = (type: string, element: Element) => {
    const box = element.getBoundingClientRect();
    return new PointerEvent(type, {
      bubbles: true,
      isPrimary: true,
      button: 0,
      pointerId: 1,
      pointerType,
      clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2,
    });
  };
  from.dispatchEvent(pointer("pointerdown", from));
  if (hold) await new Promise((resolve) => setTimeout(resolve, 500));
  from.dispatchEvent(pointer("pointermove", to));
  from.dispatchEvent(pointer("pointerup", to));
}

afterEach(async () => {
  await page.viewport(1440, 900);
});

describe("ReaderManager", () => {
  it("reads aloud from the selected word's phrase, underlining what it speaks", async () => {
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await word("学习").click();
    await screen.getByRole("button", { name: "Read aloud from the selected word" }).click();

    await expect.poll(spoken).toBe("中文很好！");
    expect(callsTo(calls, "speak")).toEqual([
      { text: "我们学习中文。", speaker: "lingyu" },
      { text: "中文很好！", speaker: "lingyu" },
    ]);

    await screen.getByRole("button", { name: "Pause reading" }).click();
    await screen.getByRole("button", { name: "Resume reading" }).click();
    await screen.getByRole("button", { name: "Stop reading" }).click();
    await expect.poll(spoken).toBe("");
    await expect
      .element(screen.getByRole("button", { name: "Read aloud from the selected word" }))
      .toBeVisible();
  });

  it("reads on into the next chapter", async () => {
    const { calls } = mockBook();
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("序言")).toBeVisible();
    await screen.getByRole("button", { name: "Read aloud from the selected word" }).click();

    await expect.poll(spoken).toBe("中文很好！");
    expect(callsTo(calls, "speak")).toEqual([
      { text: "序言很短。", speaker: "lingyu" },
      { text: "我们学习中文。", speaker: "lingyu" },
      { text: "中文很好！", speaker: "lingyu" },
    ]);
    expect(callsTo(calls, "set_reading_position")).toContainEqual({
      documentId: 1,
      section: 1,
      paragraph: 0,
    });
  });

  it("reads from the text in view, keeps it mid-screen and offers a way back once scrolled away", async () => {
    const paragraphs = Array.from({ length: 300 }, (_, index) => `段落${index} 。`);
    mockCommands({
      list_documents: () => [makeDocument({ id: 1, readingSection: 0 })],
      list_sections: () => ["第一章"],
      get_section: () => makeSection(paragraphs),
      get_word_statuses: () => ({}),
      set_reading_position: () => null,
      speak: () => new Promise(() => {}),
    });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    const text = screen.getByTestId("reader-text");
    await expect.element(word("段落0")).toBeInTheDocument();
    text.element().setAttribute("style", "height: 20rem; flex: none");
    text.element().scrollTop = text.element().scrollHeight / 2;
    await expect.element(word("段落0")).not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Read aloud from the selected word" }).click();
    await expect.poll(spoken).not.toBe("");
    const box = text.element().getBoundingClientRect();
    /** How far down the view the spoken phrase starts, as a fraction of its height. */
    const spokenAt = () => {
      const reading = text.element().querySelector("[data-spoken]");
      return reading ? (reading.getBoundingClientRect().top - box.top) / box.height : null;
    };
    await expect.poll(spokenAt).toBeGreaterThanOrEqual(0.2);
    expect(spokenAt()).toBeLessThanOrEqual(0.45);

    const back = screen.getByRole("button", { name: "Back to reading aloud" });
    await expect.element(back).not.toBeInTheDocument();
    text.element().scrollTop = 0;
    await back.click();

    await expect.element(back).not.toBeInTheDocument();
    await expect.poll(spokenAt).toBeGreaterThanOrEqual(0.2);
    expect(spokenAt()).toBeLessThanOrEqual(0.45);
  });

  it("offers to translate, play or copy a stretch dragged over, until tapped away", async () => {
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await word("我们").click();
    await expect.element(screen.getByRole("button", { name: "Learn it" })).toBeVisible();
    await drag(word("学习").element(), word("中文").element());

    const toolbar = screen.getByRole("toolbar", { name: "Selected text" });
    await expect.element(toolbar).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Learn it" })).not.toBeInTheDocument();
    expect(callsTo(calls, "translate")).toEqual([]);

    await toolbar.getByRole("button", { name: "Listen" }).click();
    await expect
      .poll(() => callsTo(calls, "speak"))
      .toEqual([{ text: "学习中文", speaker: "lingyu" }]);

    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await toolbar.getByRole("button", { name: "Copy" }).click();
    await expect.element(screen.getByText("Copied")).toBeVisible();
    expect(copy).toHaveBeenCalledWith("学习中文");
    copy.mockRestore();

    await screen.getByText("。").first().click();
    await expect.element(toolbar).not.toBeInTheDocument();
  });

  it("shows the translation in place of the word until a word is tapped", async () => {
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("学习")).toBeVisible();
    await drag(word("学习").element(), word("中文").element());
    await screen.getByRole("toolbar").getByRole("button", { name: "Translate" }).click();

    const translation = screen.getByRole("region", { name: "Translation" });
    await expect.element(translation.getByText("In English: 学习中文")).toBeVisible();
    await expect.element(screen.getByText("学习中文", { exact: true })).toBeVisible();
    await expect.element(screen.getByRole("toolbar")).not.toBeInTheDocument();

    // Tapping the text away from a word leaves an open translation alone.
    await screen.getByText("。").first().click();
    await expect.element(translation).toBeVisible();

    await word("好").click();
    await expect.element(screen.getByRole("button", { name: "Learn it" })).toBeVisible();
    await expect.element(translation).not.toBeInTheDocument();
    await expect.element(screen.getByRole("toolbar")).not.toBeInTheDocument();
    expect(callsTo(calls, "translate")).toEqual([{ text: "学习中文" }]);
  });

  it("scrolls instead of selecting when a press moves before the hold ends", async () => {
    await page.viewport(375, 800);
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("我们")).toBeVisible();
    await drag(word("我们").element(), word("好").element(), {
      pointerType: "touch",
      hold: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect.element(screen.getByRole("toolbar")).not.toBeInTheDocument();

    // Held and let go in place, it is a slow tap.
    await drag(word("我们").element(), word("我们").element(), { pointerType: "touch" });
    await expect.element(screen.getByRole("toolbar")).not.toBeInTheDocument();
    expect(callsTo(calls, "translate")).toEqual([]);
  });

  it("drags a selection with a finger after a hold, in either direction", async () => {
    await page.viewport(375, 800);
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    const secondParagraph = screen.getByRole("button", { name: "中文", exact: true }).nth(1);
    await expect.element(secondParagraph).toBeVisible();
    await drag(word("好").element(), secondParagraph.element(), { pointerType: "touch" });
    await screen.getByRole("toolbar").getByRole("button", { name: "Translate" }).click();

    const drawer = screen.getByRole("dialog", { name: "中文很好" });
    await expect.element(drawer.getByText("In English: 中文很好")).toBeVisible();
    expect(callsTo(calls, "translate")).toEqual([{ text: "中文很好" }]);
  });

  it("pauses reading aloud once a press holds still on the text", async () => {
    mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await word("好").click();
    await screen.getByRole("button", { name: "Read aloud from the selected word" }).click();
    await expect.element(screen.getByRole("button", { name: "Pause reading" })).toBeVisible();
    await drag(word("我们").element(), word("学习").element());

    await expect.element(screen.getByRole("button", { name: "Resume reading" })).toBeVisible();
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
    await expect
      .poll(() => callsTo(calls, "speak")[1])
      .toEqual({ text: "我们学习中文。", speaker: "lingyu" });
  });

  it("opens the book where it was left and colours words by status", async () => {
    const { calls } = mockBook({ readingSection: 1, known: ["我们"], learning: ["学习"] });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("学习")).toHaveAttribute("data-status", "learning");
    await expect.element(word("我们")).toHaveAttribute("data-status", "known");
    await expect.element(word("中文")).toHaveAttribute("data-status", "unseen");
    await expect.element(screen.getByText("三体")).toBeVisible();
    expect(callsTo(calls, "get_section")).toEqual([
      { documentId: 1, position: 1, script: "simplified", notation: null },
    ]);
  });

  it("writes each character's reading above it once the settings ask for one", async () => {
    readerNotationAtom.set("pinyin");
    const section = makeSection(["我们 学习 。"]);
    const readings = [["wǒ", "men"], ["xué", "xí"], []];
    section.paragraphs[0]?.forEach((token, index) => {
      token.reading = readings[index] ?? [];
    });
    const calls = mockCommands({
      list_documents: () => [makeDocument({ id: 1 })],
      list_sections: () => [null],
      get_section: () => section,
      get_word_statuses: () => ({}),
    });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("我们").getByText("wǒ")).toBeVisible();
    expect(
      [...document.querySelectorAll("[data-token] rt")].map((reading) => reading.textContent)
    ).toEqual(["wǒ", "men", "xué", "xí"]);
    expect(callsTo(calls, "get_section")).toEqual([
      { documentId: 1, position: 0, script: "simplified", notation: "pinyin" },
    ]);
  });

  it("looks up a selected word and sorts it", async () => {
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(screen.getByText(/Select a word in the text/)).toBeVisible();
    await word("中文").click();
    await expect.element(screen.getByText("Zhōng wén")).toBeVisible();
    const instances = screen.getByRole("button", { name: "中文", exact: true });
    await expect.element(instances.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect.element(instances.nth(1)).toHaveAttribute("aria-pressed", "false");
    await expect.element(screen.getByText("Chinese language")).toBeVisible();

    await screen.getByRole("button", { name: "Learn it" }).click();
    await expect.element(word("中文")).toHaveAttribute("data-status", "learning");
    await expect.element(screen.getByRole("button", { name: "Learn it" })).toBeDisabled();
    expect(callsTo(calls, "set_word_status")).toEqual([{ word: "中文", status: "learning" }]);
  });

  it("shows the selected word in a drawer over the text on phones", async () => {
    await page.viewport(375, 800);
    const { calls } = mockBook({ readingSection: 1 });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("中文")).toBeVisible();
    await expect.element(screen.getByText(/Select a word in the text/)).not.toBeInTheDocument();
    const chapter = screen.getByRole("combobox", { name: "Chapter" }).element();
    const back = screen.getByRole("button", { name: "Back to library" }).element();
    expect(chapter.getBoundingClientRect().top).toBeLessThan(back.getBoundingClientRect().bottom);
    await word("中文").click();
    const drawer = screen.getByRole("dialog", { name: "中文" });
    await expect.element(drawer.getByText("Chinese language")).toBeVisible();

    await drawer.getByRole("button", { name: "I know it" }).click();
    await expect.element(word("中文")).toHaveAttribute("data-status", "known");
    expect(callsTo(calls, "set_word_status")).toEqual([{ word: "中文", status: "known" }]);

    await userEvent.keyboard("{Escape}");
    await expect.element(drawer).not.toBeInTheDocument();
    await expect.element(word("中文")).toHaveAttribute("aria-pressed", "false");
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

  it("asks to download the translator first, then translates once it arrives", async () => {
    const models: ModelStatus[] = [{ model: "translator", bytes: 172_000_000, downloaded: false }];
    let channel: unknown;
    let finish = () => {};
    const { calls } = mockBook({
      readingSection: 1,
      models,
      download: ({ onProgress }) =>
        new Promise((resolve) => {
          channel = onProgress;
          finish = () => {
            models[0] = { model: "translator", bytes: 172_000_000, downloaded: true };
            resolve(true);
          };
        }),
    });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await expect.element(word("学习")).toBeVisible();
    await drag(word("学习").element(), word("中文").element());
    await screen.getByRole("toolbar").getByRole("button", { name: "Translate" }).click();
    const prompt = screen.getByRole("dialog", { name: "Download the translator?" });
    await expect.element(prompt.getByText(/one-time download of 172 MB/)).toBeVisible();
    await prompt.getByRole("button", { name: "Download" }).click();

    const translation = screen.getByRole("region", { name: "Translation" });
    await expect.element(translation.getByText("Downloading the translator…")).toBeVisible();
    await expect.poll(() => channel).toBeDefined();
    sendToChannel(channel, { downloaded: 43_000_000, total: 172_000_000 });
    await expect.element(translation.getByText("25%")).toBeVisible();
    expect(callsTo(calls, "translate")).toEqual([]);

    finish();
    await expect.element(translation.getByText("In English: 学习中文")).toBeVisible();
    expect(callsTo(calls, "download_model").map((args) => args.model)).toEqual(["translator"]);
  });

  it("asks before downloading speech, and plays nothing when declined", async () => {
    const { calls } = mockBook({
      readingSection: 1,
      models: [{ model: "voice", bytes: 243_000_000, downloaded: false }],
    });
    await renderPageInRouter(<ReaderManager documentId={1} />);

    await word("学习").click();
    await screen.getByRole("button", { name: "Read aloud from the selected word" }).click();
    const prompt = screen.getByRole("dialog", { name: "Download speech?" });
    await expect.element(prompt.getByText(/one-time download of 243 MB/)).toBeVisible();
    await prompt.getByRole("button", { name: "Cancel" }).click();

    await expect.element(prompt).not.toBeInTheDocument();
    expect(callsTo(calls, "speak")).toEqual([]);
    expect(callsTo(calls, "download_model")).toEqual([]);
  });
});
