import { page, page as screen, userEvent } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDeck, makeDocument, makeReviewQueue } from "@/shared/test/fixtures.ts";
import { mockCommands } from "@/shared/test/tauri.ts";
import { renderRoute } from "@/app/testing/router.tsx";

beforeEach(async () => {
  await page.viewport(375, 800);
});
afterEach(async () => {
  await page.viewport(1440, 900);
});

describe("BottomNav", () => {
  it("replaces the sidebar on phones and navigates between sections", async () => {
    mockCommands({
      list_documents: () => [],
      list_folders: () => [],
      get_review_queue: () => makeReviewQueue([]),
    });
    const { router } = await renderRoute("/library");

    const navigation = screen.getByRole("navigation");
    await expect
      .element(navigation.getByRole("link", { name: "Library" }))
      .toHaveAttribute("aria-current", "page");
    expect(document.querySelector("[data-slot=sidebar]")).toBeNull();

    await userEvent.click(navigation.getByRole("link", { name: "Review" }));
    await expect.element(screen.getByText("Nothing to review")).toBeVisible();
    expect(router.state.location.pathname).toBe("/review");
  });

  it("opens the settings page", async () => {
    mockCommands({ list_documents: () => [], list_folders: () => [] });
    const { router } = await renderRoute("/library");

    await userEvent.click(screen.getByRole("navigation").getByRole("link", { name: "Settings" }));

    await expect.element(screen.getByRole("button", { name: "Dark" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/settings");
  });

  it("is hidden on a book's deck", async () => {
    mockCommands({
      get_deck: () => makeDeck([], { document: makeDocument({ id: 7, title: "红楼梦" }) }),
    });
    await renderRoute("/library/7");

    await expect.element(screen.getByText("红楼梦")).toBeVisible();
    await expect.element(screen.getByRole("navigation")).not.toBeInTheDocument();
  });
});
