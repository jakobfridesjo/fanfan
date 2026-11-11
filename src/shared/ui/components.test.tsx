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
      <PageHeader title="Library">
        <button type="button">Import book</button>
      </PageHeader>
    );
    await expect.element(screen.getByText("Library")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Import book" })).toBeVisible();
  });
  it("hides the actions behind a menu on mobile", async () => {
    await page.viewport(375, 800);
    await renderPage(
      <PageHeader title="Library">
        <button type="button">Import book</button>
      </PageHeader>
    );
    await expect
      .element(screen.getByRole("button", { name: "Import book" }))
      .not.toBeInTheDocument();
    const actions = screen.getByRole("button", { name: "Actions" });
    await userEvent.click(actions);
    await expect.element(screen.getByRole("button", { name: "Import book" })).toBeVisible();
  });
  it("moves actions that do not fit beside the title into the menu", async () => {
    await page.viewport(800, 800);
    await renderPage(
      <div className="w-full">
        <PageHeader title="Library">
          <button type="button" style={{ width: 900 }}>
            Import book
          </button>
        </PageHeader>
      </div>
    );
    await expect.element(screen.getByRole("button", { name: "Actions" })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Import book" }))
      .not.toBeInTheDocument();

    await page.viewport(1440, 900);
    await expect.element(screen.getByRole("button", { name: "Import book" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Actions" })).not.toBeInTheDocument();
  });
  it("leaves out the mobile menu when the page has no actions", async () => {
    await page.viewport(375, 800);
    await renderPage(<PageHeader title="Library" />);
    await expect.element(screen.getByRole("button", { name: "Actions" })).not.toBeInTheDocument();
  });
});
describe("TooltipIconButton", () => {
  it("labels the button for assistive tech", async () => {
    const onClick = vi.fn();
    await renderPage(
      <TooltipIconButton label="Delete book" onClick={onClick}>
        <span aria-hidden="true">x</span>
      </TooltipIconButton>
    );
    const button = screen.getByRole("button", { name: "Delete book" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });
  it("shows each button's own tooltip on hover", async () => {
    await renderPage(
      <>
        <TooltipIconButton label="Delete" tooltip="Delete book">
          <span aria-hidden="true">x</span>
        </TooltipIconButton>
        <TooltipIconButton label="Copy" tooltip="Copy word">
          <span aria-hidden="true">c</span>
        </TooltipIconButton>
      </>
    );
    await userEvent.hover(screen.getByRole("button", { name: "Copy" }));
    await expect.element(screen.getByText("Copy word")).toBeVisible();
    await expect.element(screen.getByText("Delete book")).not.toBeInTheDocument();
  });
});
