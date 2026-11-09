import { page, page as screen, userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { renderPage } from "@/shared/test/render.tsx";
afterEach(async () => {
  await page.viewport(1440, 900);
});
describe("PageHeader", () => {
  it("shows the title and actions side by side on desktop", async () => {
    await renderPage(
      <PageHeader title="Templates">
        <button type="button">New template</button>
      </PageHeader>
    );
    await expect.element(screen.getByText("Templates")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "New template" })).toBeVisible();
  });
  it("hides the actions behind a menu on mobile", async () => {
    await page.viewport(375, 800);
    await renderPage(
      <PageHeader title="Templates">
        <button type="button">New template</button>
      </PageHeader>
    );
    await expect
      .element(screen.getByRole("button", { name: "New template" }))
      .not.toBeInTheDocument();
    const actions = screen.getByRole("button", { name: "Actions" });
    await userEvent.click(actions);
    await expect.element(screen.getByRole("button", { name: "New template" })).toBeVisible();
  });
  it("moves actions that do not fit beside the title into the menu", async () => {
    await page.viewport(800, 800);
    await renderPage(
      <div className="w-full">
        <PageHeader title="Templates">
          <button type="button" style={{ width: 900 }}>
            New template
          </button>
        </PageHeader>
      </div>
    );
    await expect.element(screen.getByRole("button", { name: "Actions" })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "New template" }))
      .not.toBeInTheDocument();

    await page.viewport(1440, 900);
    await expect.element(screen.getByRole("button", { name: "New template" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Actions" })).not.toBeInTheDocument();
  });
  it("leaves out the mobile menu when the page has no actions", async () => {
    await page.viewport(375, 800);
    await renderPage(<PageHeader title="Templates" />);
    await expect.element(screen.getByRole("button", { name: "Actions" })).not.toBeInTheDocument();
  });
  it("stays quiet when no header text is configured", async () => {
    await renderPage(<PageHeader title="Templates" />);
    await expect.element(screen.getByRole("status")).not.toBeInTheDocument();
  });
});
describe("TooltipIconButton", () => {
  it("labels the button for assistive tech", async () => {
    const onClick = vi.fn();
    await renderPage(
      <TooltipIconButton label="Delete template" onClick={onClick}>
        <span aria-hidden="true">x</span>
      </TooltipIconButton>
    );
    const button = screen.getByRole("button", { name: "Delete template" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });
});
