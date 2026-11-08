import { page as screen } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { languageAtom } from "@/shared/config/preferences.ts";
import { renderPage } from "@/shared/test/render.tsx";
import AboutPage from "@/pages/about/ui/AboutPage.tsx";

describe("AboutPage", () => {
  it("shows the version and credits the bundled data in the chosen language", async () => {
    await renderPage(<AboutPage />);

    await expect.element(screen.getByText(/^Version \d+\.\d+\.\d+/)).toBeVisible();
    await expect.element(screen.getByText("By Jakob Fridesjö")).toBeVisible();
    await expect.element(screen.getByText("CC-CEDICT")).toBeVisible();
    await expect.element(screen.getByText("CC BY-SA 4.0")).toBeVisible();

    languageAtom.set("zh");
    await expect.element(screen.getByText("致谢")).toBeVisible();
    await expect.element(screen.getByText("词典")).toBeVisible();
  });
});
