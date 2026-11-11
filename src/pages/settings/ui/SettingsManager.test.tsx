import { page as screen } from "vitest/browser";
import { describe, expect, it } from "vitest";
import {
  backgroundAtom,
  languageAtom,
  readerNotationAtom,
  scriptAtom,
  shownExamsAtom,
  shownNotationsAtom,
  speakerAtom,
  themeAtom,
} from "@/shared/config/preferences.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { silentOpus } from "@/shared/test/fixtures.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { callsTo, mockCommands, sendToChannel } from "@/shared/test/tauri.ts";
import SettingsManager from "@/pages/settings/ui/SettingsManager.tsx";

describe("SettingsManager", () => {
  it("translates the interface and formats numbers for the chosen language", async () => {
    await renderPageInRouter(<SettingsManager />);

    await screen.getByRole("button", { name: "Svenska" }).click();

    await expect.element(screen.getByText("Inställningar")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Körsbär" })).toBeVisible();
    expect(formatInteger(1234)).toBe("1\u00a0234");
    expect(localStorage.getItem("language")).toBe("sv");

    await screen.getByRole("button", { name: "中文（简体）" }).click();
    await expect.element(screen.getByText("设置")).toBeVisible();
    expect(languageAtom.get()).toBe("zh");
  });

  it("keeps one script and one background chosen", async () => {
    await renderPageInRouter(<SettingsManager />);

    const traditional = screen.getByRole("button", { name: "Traditional" });
    await traditional.click();
    await expect.element(traditional).toHaveAttribute("aria-pressed", "true");
    // Pressing the chosen option again leaves it chosen.
    await traditional.click();
    await expect.element(traditional).toHaveAttribute("aria-pressed", "true");
    expect(scriptAtom.get()).toBe("traditional");

    await screen.getByRole("button", { name: "Plain" }).click();
    expect(backgroundAtom.get()).toBe("plain");
    expect(localStorage.getItem("background")).toBe("plain");
  });

  it("turns pinyin, zhuyin and Cangjie on and off on their own", async () => {
    await renderPageInRouter(<SettingsManager />);

    const notations = screen.getByRole("group", { name: "Readings and input codes" });
    const pinyin = notations.getByRole("button", { name: "Pinyin" });
    await expect.element(pinyin).toHaveAttribute("aria-pressed", "true");

    await notations.getByRole("button", { name: "Cangjie" }).click();
    await notations.getByRole("button", { name: "Zhuyin" }).click();
    expect(shownNotationsAtom.get()).toEqual(["pinyin", "zhuyin", "cangjie"]);

    await pinyin.click();
    await expect.element(pinyin).toHaveAttribute("aria-pressed", "false");
    expect(shownNotationsAtom.get()).toEqual(["zhuyin", "cangjie"]);
    expect(localStorage.getItem("shownNotations")).toBe('["zhuyin","cangjie"]');
  });

  it("chooses the reading the reader writes above each character", async () => {
    await renderPageInRouter(<SettingsManager />);

    const readings = screen.getByRole("group", { name: "Readings in the reader" });
    await expect
      .element(readings.getByRole("button", { name: "Off" }))
      .toHaveAttribute("aria-pressed", "true");

    await readings.getByRole("button", { name: "Zhuyin" }).click();
    expect(readerNotationAtom.get()).toBe("zhuyin");
    expect(localStorage.getItem("readerNotation")).toBe("zhuyin");
  });

  it("turns each exam's levels on and off on their own", async () => {
    await renderPageInRouter(<SettingsManager />);

    const hsk = screen.getByRole("button", { name: "HSK" });
    const tbcl = screen.getByRole("button", { name: "TBCL" });
    const tocfl = screen.getByRole("button", { name: "TOCFL" });
    await expect.element(hsk).toHaveAttribute("aria-pressed", "true");
    await expect.element(tocfl).toHaveAttribute("aria-pressed", "true");

    await hsk.click();
    expect(shownExamsAtom.get()).toEqual(["tbcl", "tocfl"]);
    await tocfl.click();
    expect(shownExamsAtom.get()).toEqual(["tbcl"]);
    await tbcl.click();
    expect(shownExamsAtom.get()).toEqual([]);
    expect(localStorage.getItem("shownExams")).toBe("[]");

    await tbcl.click();
    await expect.element(tbcl).toHaveAttribute("aria-pressed", "true");
    expect(shownExamsAtom.get()).toEqual(["tbcl"]);
  });

  it("saves the chosen appearance", async () => {
    await renderPageInRouter(<SettingsManager />);

    const dark = screen.getByRole("button", { name: "Dark" });
    await dark.click();

    await expect.element(dark).toHaveAttribute("aria-pressed", "true");
    expect(themeAtom.get()).toBe("dark");
  });

  it("reads a sample in the chosen voice", async () => {
    const calls = mockCommands({ speak: () => silentOpus() });
    await renderPageInRouter(<SettingsManager />);

    const storyteller = screen.getByRole("button", { name: "Weiguo Storyteller" });
    await storyteller.click();
    await expect.element(storyteller).toHaveAttribute("aria-pressed", "true");
    expect(speakerAtom.get()).toBe("weiguo");
    expect(localStorage.getItem("speaker")).toBe("weiguo");

    await screen.getByRole("button", { name: "Play a sample" }).click();
    await expect
      .poll(() => callsTo(calls, "speak"))
      .toEqual([{ text: "你好！我们一起来读这本书吧。", speaker: "weiguo" }]);
  });

  it("links to the about page", async () => {
    const { router } = await renderPageInRouter(<SettingsManager />);

    await screen.getByRole("link", { name: "About 翻翻" }).click();

    expect(router.state.location.pathname).toBe("/about");
  });

  it("downloads a model, showing how much has arrived, and deletes one after asking", async () => {
    const downloaded = new Set(["voice"]);
    let channel: unknown;
    let finish = () => {};
    const calls = mockCommands({
      list_models: () => [
        { model: "voice", bytes: 243_000_000, downloaded: downloaded.has("voice") },
        { model: "translator", bytes: 172_000_000, downloaded: downloaded.has("translator") },
      ],
      download_model: ({ model, onProgress }) =>
        new Promise((resolve) => {
          channel = onProgress;
          finish = () => {
            downloaded.add(model as string);
            resolve(true);
          };
        }),
      delete_model: ({ model }) => {
        downloaded.delete(model as string);
        return null;
      },
    });
    await renderPageInRouter(<SettingsManager />);

    const translation = screen.getByRole("region", { name: "Translation" });
    await translation.getByRole("button", { name: "Download" }).click();
    await expect.poll(() => channel).toBeDefined();
    sendToChannel(channel, { downloaded: 86_000_000, total: 172_000_000 });
    await expect.element(translation.getByText("Downloading… 86 MB of 172 MB")).toBeVisible();
    await expect.element(translation.getByText("50%")).toBeVisible();
    finish();
    await expect.element(translation.getByText("Downloaded")).toBeVisible();
    expect(callsTo(calls, "download_model").map((args) => args.model)).toEqual(["translator"]);

    const speech = screen.getByRole("region", { name: "Speech" });
    await speech.getByRole("button", { name: "Delete" }).click();
    await screen.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect.element(speech.getByRole("button", { name: "Download" })).toBeVisible();
    expect(callsTo(calls, "delete_model")).toEqual([{ model: "voice" }]);
  });

  it("says where a failed download stopped and carries on when tried again", async () => {
    let attempts = 0;
    const calls = mockCommands({
      list_models: () => [
        { model: "voice", bytes: 243_000_000, downloaded: false },
        { model: "translator", bytes: 172_000_000, downloaded: attempts > 1 },
      ],
      download_model: () => {
        attempts += 1;
        if (attempts === 1) throw new Error("Could not download the model: no connection");
        return true;
      },
    });
    await renderPageInRouter(<SettingsManager />);

    const translation = screen.getByRole("region", { name: "Translation" });
    await translation.getByRole("button", { name: "Download" }).click();
    const failure = translation.getByRole("alert");
    await expect.element(failure.getByText(/stopped at 0 MB of 172 MB/)).toBeVisible();
    await expect
      .element(failure.getByText("Could not download the model: no connection"))
      .toBeVisible();

    await translation.getByRole("button", { name: "Try again" }).click();
    await expect.element(translation.getByText("Downloaded")).toBeVisible();
    expect(callsTo(calls, "download_model")).toHaveLength(2);
  });
});
