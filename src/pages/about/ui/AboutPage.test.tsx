import { page as screen, userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { languageAtom } from "@/shared/config/preferences.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import AboutPage from "@/pages/about/ui/AboutPage.tsx";

describe("AboutPage", () => {
  it("shows the version, credits the bundled data and lists third-party licences", async () => {
    await renderPageInRouter(<AboutPage />);

    await expect.element(screen.getByText(/^Version \d+\.\d+\.\d+/)).toBeVisible();
    await expect.element(screen.getByText("By Jakob Fridesjö")).toBeVisible();
    await expect.element(screen.getByText("CC-CEDICT")).toBeVisible();
    await expect.element(screen.getByText("CC BY-SA 4.0")).toBeVisible();

    await screen.getByRole("button", { name: "Show licences" }).click();
    await screen.getByRole("button", { name: /react-dom 19/ }).click();
    await expect.element(screen.getByText(/Permission is hereby granted/).first()).toBeVisible();
    await userEvent.keyboard("{Escape}");

    languageAtom.set("zh");
    await expect.element(screen.getByText("致谢")).toBeVisible();
    await expect.element(screen.getByText("词典")).toBeVisible();
  });

  it("goes back to the settings", async () => {
    const { router } = await renderPageInRouter(<AboutPage />, { initialPath: "/about" });

    await screen.getByRole("button", { name: "Back" }).click();

    expect(router.state.location.pathname).toBe("/settings");
  });
});
