import { page, page as screen, userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorSheet } from "@/shared/ui/EditorSheet.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { PageLoadingSkeleton } from "@/shared/ui/PageLoadingSkeleton.tsx";
import { InfoTooltip } from "@/shared/ui/InfoTooltip.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { renderPage } from "@/shared/test/render.tsx";
afterEach(async () => {
  await page.viewport(1440, 900);
});
describe("PageLoadingSkeleton", () => {
  it.each(["table", "workspace"] as const)("labels the %s loading state", async (layout) => {
    await renderPage(<PageLoadingSkeleton title="Templates" layout={layout} />);

    await expect.element(screen.getByText("Templates")).toBeVisible();
    await expect.element(screen.getByRole("status", { name: "Loading Templates" })).toBeVisible();
  });
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
describe("InfoTooltip", () => {
  it("renders a hoverable hint", async () => {
    await renderPage(
      <InfoTooltip label="About templates">Only applies to local templates</InfoTooltip>
    );
    await expect.element(screen.getByRole("button", { name: "About templates" })).toBeVisible();
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
describe("EditorSheet", () => {
  it("renders nothing while closed", async () => {
    await renderPage(
      <EditorSheet open={false} onClose={vi.fn()} title="Edit template">
        <p>Body</p>
      </EditorSheet>
    );
    await expect.element(screen.getByText("Body")).not.toBeInTheDocument();
  });
  it("shows the title, description, body and footer when open", async () => {
    await renderPage(
      <EditorSheet
        open
        onClose={vi.fn()}
        title="Edit template"
        description="Changes apply immediately"
        footer={<button type="button">Save</button>}
      >
        <p>Body</p>
      </EditorSheet>
    );
    await expect.element(screen.getByText("Edit template")).toBeVisible();
    await expect.element(screen.getByText("Changes apply immediately")).toBeVisible();
    await expect.element(screen.getByText("Body")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Save" })).toBeVisible();
  });
  it("closes on escape", async () => {
    const onClose = vi.fn();
    await renderPage(
      <EditorSheet open onClose={onClose} title="Edit template">
        <p>Body</p>
      </EditorSheet>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
  it("asks before discarding unsaved changes", async () => {
    const onClose = vi.fn();
    await renderPage(
      <EditorSheet open dirty onClose={onClose} title="Edit template">
        <p>Body</p>
      </EditorSheet>
    );
    await userEvent.keyboard("{Escape}");
    const discard = screen.getByRole("alertdialog", { name: "Discard Changes" });
    await discard.getByRole("button", { name: "Cancel" }).click();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    await screen.getByRole("alertdialog").getByRole("button", { name: "Discard" }).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("stays open while saving", async () => {
    const onClose = vi.fn();
    await renderPage(
      <EditorSheet open pending onClose={onClose} title="Edit template">
        <p>Body</p>
      </EditorSheet>
    );
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByText("Body")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
