import { page as screen } from "vitest/browser";
import { describe, expect, it } from "vitest";
import PageLayout from "@/app/layouts/PageLayout.tsx";
import { renderPage } from "@/shared/test/render.tsx";

describe("PageLayout", () => {
  it("wraps the page content", async () => {
    await renderPage(
      <PageLayout>
        <p>Notes</p>
      </PageLayout>
    );
    await expect.element(screen.getByText("Notes")).toBeVisible();
  });
});
