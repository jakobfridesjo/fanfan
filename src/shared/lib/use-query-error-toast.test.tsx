import { createSignal, flush } from "solid-js";
import { page as screen } from "vitest/browser";
import { beforeEach, describe, expect, it } from "vitest";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import { render } from "@/shared/test/solid.ts";
import { Toaster } from "@/shared/ui/Toaster.tsx";
beforeEach(() => {
  render(() => <Toaster />);
});
function renderToast(initial: string | null) {
  const [message, setMessage] = createSignal(initial);
  const view = render(() => {
    useQueryErrorToast(message, "templates");
    return null;
  });
  return {
    unmount: view.unmount,
    rerender: (next: { message: string | null }) => {
      setMessage(next.message);
      flush();
    },
  };
}
describe("useQueryErrorToast", () => {
  it("shows nothing while the query is healthy", async () => {
    renderToast(null);
    await expect
      .element(screen.getByRole("region", { name: /^Notifications/ }).getByRole("listitem"))
      .not.toBeInTheDocument();
  });
  it("raises the message as a toast", async () => {
    renderToast("Failed to load templates");
    await expect.element(screen.getByText("Failed to load templates")).toBeInTheDocument();
  });
  it("replaces the toast when the message changes", async () => {
    const { rerender } = renderToast("Failed to load templates");
    await expect.element(screen.getByText("Failed to load templates")).toBeInTheDocument();
    rerender({ message: "Still failing" });
    await expect.element(screen.getByText("Still failing")).toBeInTheDocument();
    await expect.element(screen.getByText("Failed to load templates")).not.toBeInTheDocument();
  });
  it("clears the toast once the query recovers", async () => {
    const { rerender } = renderToast("Failed to load templates");
    await expect.element(screen.getByText("Failed to load templates")).toBeInTheDocument();
    rerender({ message: null });
    await expect.element(screen.getByText("Failed to load templates")).not.toBeInTheDocument();
  });
  it("clears the toast on unmount", async () => {
    const { unmount } = renderToast("Failed");
    await expect.element(screen.getByText("Failed")).toBeInTheDocument();
    unmount();
    await expect.element(screen.getByText("Failed")).not.toBeInTheDocument();
  });
});
