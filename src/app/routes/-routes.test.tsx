import { page as screen } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import {
  makeCard,
  makeDeck,
  makeDocument,
  makeReviewQueue,
  makeSection,
  makeWordEntry,
} from "@/shared/test/fixtures.ts";
import { callsTo, mockCommands } from "@/shared/test/tauri.ts";
import { renderRoute } from "@/app/testing/router.tsx";

describe("routes", () => {
  it("redirects the root to the library inside the app shell", async () => {
    mockCommands({
      list_documents: () => [makeDocument({ title: "西游记" })],
      list_folders: () => [],
    });
    const { router } = await renderRoute("/");

    await expect.element(screen.getByText("西游记")).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Library" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Review" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Known words" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/library");
  });

  it("opens a book's deck by its id", async () => {
    const calls = mockCommands({
      get_deck: () => makeDeck([], { document: makeDocument({ id: 7, title: "红楼梦" }) }),
    });
    await renderRoute("/library/7");

    await expect.element(screen.getByText("红楼梦")).toBeVisible();
    expect(calls[0]).toEqual({
      command: "get_deck",
      args: { documentId: 7, limit: 30, script: "simplified" },
    });
  });

  it("opens a book's reader by its id", async () => {
    const calls = mockCommands({
      list_documents: () => [makeDocument({ id: 7, title: "红楼梦", readingSection: 2 })],
      list_sections: () => [null, null, "第三回"],
      get_section: () => makeSection(["宝玉 笑 道 。"], { position: 2 }),
      get_word_statuses: () => ({}),
    });
    await renderRoute("/read/7");

    await expect.element(screen.getByRole("button", { name: "宝玉" })).toBeVisible();
    await expect.element(screen.getByText("红楼梦")).toBeVisible();
    expect(callsTo(calls, "get_section")).toEqual([
      { documentId: 7, position: 2, script: "simplified" },
    ]);
  });

  it("renders the review and known-words pages", async () => {
    mockCommands({
      get_review_queue: () => makeReviewQueue([]),
      list_words: () => [makeWordEntry("学习")],
    });
    const { router } = await renderRoute("/review");
    await expect.element(screen.getByText("Nothing to review")).toBeVisible();

    await router.navigate({ to: "/known-words" });
    await expect.element(screen.getByText("学习", { exact: true })).toBeVisible();
  });

  it("opens settings from the sidebar and applies the script and background", async () => {
    const calls = mockCommands({
      list_documents: () => [],
      list_folders: () => [],
      get_review_queue: ({ script }) =>
        makeReviewQueue([
          makeCard("学习", { displayWord: script === "traditional" ? "學習" : "学习" }),
        ]),
    });
    const { container, router } = await renderRoute("/library");
    expect(container.querySelector(".fireflies canvas")).not.toBeNull();

    await screen.getByRole("button", { name: "Settings" }).click();
    await screen.getByRole("menuitem", { name: "All settings" }).click();
    expect(router.state.location.pathname).toBe("/settings");
    await screen.getByRole("button", { name: "Traditional" }).click();
    await screen.getByRole("button", { name: "Cherry" }).click();
    await expect.poll(() => container.querySelector(".cherry canvas")).not.toBeNull();
    expect(container.querySelector(".fireflies")).toBeNull();

    await screen.getByRole("link", { name: "Review" }).click();
    await expect.element(screen.getByText("學習", { exact: true }).first()).toBeVisible();
    const scripts = callsTo(calls, "get_review_queue").map((args) => args.script);
    expect(new Set(scripts)).toEqual(new Set(["traditional"]));
  });

  it("shows the not-found page for an unknown path or a malformed book id", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCommands({});
    const { router } = await renderRoute("/does-not-exist");
    await expect.element(screen.getByText("Page not found")).toBeVisible();

    await router.navigate({ to: "/library/$documentId", params: { documentId: -1 } });
    await expect.element(screen.getByText("Page not found")).toBeVisible();
  });
});
