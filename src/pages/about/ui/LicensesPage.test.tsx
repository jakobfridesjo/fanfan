import { page as screen } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import LicensesPage from "@/pages/about/ui/LicensesPage.tsx";

describe("LicensesPage", () => {
  it("lists third-party licences with their notices", async () => {
    await renderPageInRouter(<LicensesPage />);

    await screen.getByRole("button", { name: /react-dom 19/ }).click();
    await expect.element(screen.getByText(/Permission is hereby granted/).first()).toBeVisible();
  });

  it("goes back to the about page", async () => {
    const { router } = await renderPageInRouter(<LicensesPage />, {
      initialPath: "/about/licenses",
    });

    await screen.getByRole("button", { name: "Back" }).click();

    expect(router.state.location.pathname).toBe("/about");
  });
});
