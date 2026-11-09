import { page as screen, userEvent } from "vitest/browser";
import { describe, expect, it, onTestFinished } from "vitest";
import { SettingsMenu } from "@/app/layouts/SettingsMenu.tsx";
import { syncThemeClass } from "@/app/providers/theme-mode.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";

describe("SettingsMenu", () => {
  it("switches the document to the chosen appearance", async () => {
    onTestFinished(syncThemeClass());
    await renderPageInRouter(<SettingsMenu />);

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("opens the settings page", async () => {
    const { router } = await renderPageInRouter(<SettingsMenu />);

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "All settings" }));

    expect(router.state.location.pathname).toBe("/settings");
  });

  it("opens the about page", async () => {
    const { router } = await renderPageInRouter(<SettingsMenu />);

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "About" }));

    expect(router.state.location.pathname).toBe("/about");
  });
});
