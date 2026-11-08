import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { useKeyBindings, type KeyBindings } from "@/shared/lib/use-key-bindings.ts";

function Bindings({ bindings, enabled }: { bindings: KeyBindings; enabled?: boolean }) {
  useKeyBindings(bindings, enabled);
  return (
    <>
      <textarea aria-label="Notes" />
      <button type="button">Elsewhere</button>
    </>
  );
}

describe("useKeyBindings", () => {
  it("runs the action bound to a key and ignores unbound keys", async () => {
    const right = vi.fn();
    await render(<Bindings bindings={{ ArrowRight: right }} />);

    await userEvent.keyboard("{ArrowRight}{ArrowLeft}");
    expect(right).toHaveBeenCalledOnce();
  });

  it("ignores keys typed into a text box", async () => {
    const z = vi.fn();
    await render(<Bindings bindings={{ z }} />);

    await userEvent.click(page.getByRole("textbox", { name: "Notes" }));
    await userEvent.keyboard("z");
    await expect.element(page.getByRole("textbox", { name: "Notes" })).toHaveValue("z");
    expect(z).not.toHaveBeenCalled();
  });

  it("ignores keys pressed with a modifier", async () => {
    const z = vi.fn();
    await render(<Bindings bindings={{ z }} />);

    await userEvent.keyboard("{Control>}z{/Control}");
    expect(z).not.toHaveBeenCalled();
    await userEvent.keyboard("z");
    expect(z).toHaveBeenCalledOnce();
  });

  it("ignores keys while a dialog is open", async () => {
    const z = vi.fn();
    await render(<Bindings bindings={{ z }} />);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    await userEvent.keyboard("z");
    dialog.remove();
    expect(z).not.toHaveBeenCalled();

    await userEvent.keyboard("z");
    expect(z).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", async () => {
    const right = vi.fn();
    await render(<Bindings bindings={{ ArrowRight: right }} enabled={false} />);

    await userEvent.keyboard("{ArrowRight}");
    expect(right).not.toHaveBeenCalled();
  });
});
