import { page as screen } from "vitest/browser";
import { describe, expect, it } from "vitest";
import {
  backgroundAtom,
  languageAtom,
  scriptAtom,
  shownExamsAtom,
} from "@/shared/config/preferences.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { renderPage } from "@/shared/test/render.tsx";
import SettingsManager from "@/pages/settings/ui/SettingsManager.tsx";

describe("SettingsManager", () => {
  it("translates the interface and formats numbers for the chosen language", async () => {
    await renderPage(<SettingsManager />);

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
    await renderPage(<SettingsManager />);

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

  it("turns each exam's levels on and off on their own", async () => {
    await renderPage(<SettingsManager />);

    const hsk = screen.getByRole("button", { name: "HSK" });
    const tocfl = screen.getByRole("button", { name: "TOCFL" });
    await expect.element(hsk).toHaveAttribute("aria-pressed", "true");

    await hsk.click();
    expect(shownExamsAtom.get()).toEqual(["tocfl"]);
    await tocfl.click();
    expect(shownExamsAtom.get()).toEqual([]);
    expect(localStorage.getItem("shownExams")).toBe("[]");

    await tocfl.click();
    await expect.element(tocfl).toHaveAttribute("aria-pressed", "true");
    expect(shownExamsAtom.get()).toEqual(["tocfl"]);
  });
});
