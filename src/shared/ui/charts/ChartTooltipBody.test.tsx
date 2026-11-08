import { page as screen } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { ChartTooltipBody } from "@/shared/ui/charts/ChartTooltipBody.tsx";
import { renderPage } from "@/shared/test/render.tsx";

describe("ChartTooltipBody", () => {
  it("renders the title, one row per series with its swatch, and the total", async () => {
    const { container } = await renderPage(
      <ChartTooltipBody
        title="Date 2026-01-01"
        rows={[
          { key: "note", label: "Notes", value: "1,200", color: "red" },
          { key: "referral", label: "Referrals", value: "3" },
        ]}
        total="1,203"
      />
    );

    await expect.element(screen.getByText("Date 2026-01-01")).toBeVisible();
    await expect.element(screen.getByText("1,200")).toBeVisible();
    await expect.element(screen.getByText("Total")).toBeVisible();
    await expect.element(screen.getByText("1,203")).toBeVisible();
    expect(container.querySelectorAll(".size-2\\.5")).toHaveLength(2);
  });

  it("omits swatches and the total when asked", async () => {
    const { container } = await renderPage(
      <ChartTooltipBody rows={[{ key: "count", label: "Users", value: "7" }]} hideIndicator />
    );

    await expect.element(screen.getByText("Users")).toBeVisible();
    expect(container.querySelectorAll(".size-2\\.5")).toHaveLength(0);
    expect(container.textContent).not.toContain("Total");
  });
});
