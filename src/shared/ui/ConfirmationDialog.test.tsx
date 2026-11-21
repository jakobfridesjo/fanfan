import { createSignal } from "solid-js";
import { page as screen, userEvent } from "vitest/browser";
import { expect, it, vi } from "vitest";
import { render } from "@/shared/test/solid.ts";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";

function renderDialog(loading = false) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const [open, setOpen] = createSignal(false);
  render(() => (
    <ConfirmationDialog
      open={open()}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete book"
      message="三体 will be deleted."
      confirmLabel="Delete"
      destructive
      loading={loading}
    />
  ));
  setOpen(true);
  return { onClose, onConfirm };
}

it("confirms with its button and closes on Escape", async () => {
  const { onClose, onConfirm } = renderDialog();

  await screen
    .getByRole("alertdialog", { name: "Delete book" })
    .getByRole("button", { name: "Delete" })
    .click();
  expect(onConfirm).toHaveBeenCalledOnce();

  await userEvent.keyboard("{Escape}");
  await expect.poll(() => onClose.mock.calls.length).toBe(1);
});

it("stays open while its action runs", async () => {
  const { onClose } = renderDialog(true);

  await expect.element(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
});
