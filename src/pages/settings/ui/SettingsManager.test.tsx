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
import { callsTo, mockCommands } from "@/shared/test/tauri.ts";
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
});
