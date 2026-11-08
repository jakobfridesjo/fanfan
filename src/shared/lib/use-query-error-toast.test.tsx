import { page as screen } from "vitest/browser";
import { render, renderHook } from "vitest-browser-react";
import { beforeEach, describe, expect, it } from "vitest";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import { Toaster } from "@/shared/ui/Toaster.tsx";
beforeEach(async () => {
  await render(<Toaster />);
});
function renderToast(message: string | null) {
  return renderHook((props) => useQueryErrorToast(props!.message, "templates"), {
    initialProps: { message },
  });
}
describe("useQueryErrorToast", () => {
  it("shows nothing while the query is healthy", async () => {
    await renderToast(null);
    await expect
      .element(screen.getByRole("region", { name: /^Notifications/ }).getByRole("listitem"))
      .not.toBeInTheDocument();
  });
  it("raises the message as a toast", async () => {
    await renderToast("Failed to load templates");
    await expect.element(screen.getByText("Failed to load templates")).toBeInTheDocument();
  });
  it("replaces the toast when the message changes", async () => {
    const { rerender } = await renderToast("Failed to load templates");
    await expect.element(screen.getByText("Failed to load templates")).toBeInTheDocument();
    await rerender({ message: "Still failing" });
    await expect.element(screen.getByText("Still failing")).toBeInTheDocument();
    await expect.element(screen.getByText("Failed to load templates")).not.toBeInTheDocument();
  });
  it("clears the toast once the query recovers", async () => {
    const { rerender } = await renderToast("Failed to load templates");
    await expect.element(screen.getByText("Failed to load templates")).toBeInTheDocument();
    await rerender({ message: null });
    await expect.element(screen.getByText("Failed to load templates")).not.toBeInTheDocument();
  });
  it("clears the toast on unmount", async () => {
    const { unmount } = await renderToast("Failed");
    await expect.element(screen.getByText("Failed")).toBeInTheDocument();
    await unmount();
    await expect.element(screen.getByText("Failed")).not.toBeInTheDocument();
  });
});
