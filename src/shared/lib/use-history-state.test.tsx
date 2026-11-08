import { expect, test } from "vitest";
import * as z from "zod/mini";
import { page } from "vitest/browser";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { useHistoryState } from "@/shared/lib/use-history-state.ts";

function Search() {
  const [text, setText] = useHistoryState("search", z.string(), "");
  return <input aria-label="Search" value={text} onChange={(e) => setText(e.target.value)} />;
}

test("restores the value when navigating back to the entry", async () => {
  const { router } = await renderPageInRouter(<Search />);

  await page.getByLabelText("Search").fill("hello");
  await expect.poll(() => router.history.location.state).toMatchObject({ search: "hello" });

  router.history.push("/elsewhere");
  await expect.poll(() => router.history.location.state).not.toMatchObject({ search: "hello" });
  router.history.back();

  await expect.element(page.getByLabelText("Search")).toHaveValue("hello");
});

test("starts empty on a fresh entry", async () => {
  await renderPageInRouter(<Search />);
  await expect.element(page.getByLabelText("Search")).toHaveValue("");
});
