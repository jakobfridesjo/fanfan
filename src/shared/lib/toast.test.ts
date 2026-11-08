import { beforeEach, describe, expect, it, vi } from "vitest";
import { actionToasts, dismissToast, toastError } from "@/shared/lib/toast.ts";

const sonner = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("sonner", () => sonner);

const STICKY = { duration: Number.POSITIVE_INFINITY };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toastError", () => {
  it("stays up until dismissed", () => {
    toastError("Save failed");

    expect(sonner.toast.error).toHaveBeenCalledWith("Save failed", STICKY);
  });

  it("keeps the caller's id and description", () => {
    toastError("Save failed", { id: "save", description: "Try again" });

    expect(sonner.toast.error).toHaveBeenCalledWith("Save failed", {
      ...STICKY,
      id: "save",
      description: "Try again",
    });
  });
});

describe("dismissToast", () => {
  it("dismisses by id", () => {
    dismissToast("save");

    expect(sonner.toast.dismiss).toHaveBeenCalledWith("save");
  });
});

describe("actionToasts", () => {
  it("pins every message in the action's own slot", () => {
    const toasts = actionToasts("import");

    toasts.error("Import failed");
    toasts.warning("Partially imported");

    expect(sonner.toast.error).toHaveBeenCalledWith("Import failed", {
      ...STICKY,
      id: "import",
    });
    expect(sonner.toast.warning).toHaveBeenCalledWith("Partially imported", {
      ...STICKY,
      id: "import",
    });
  });

  it("replaces a sticky failure with a transient success", () => {
    const toasts = actionToasts("import");

    toasts.success("Imported 12 templates");

    expect(sonner.toast.dismiss).toHaveBeenCalledWith("import");
    expect(sonner.toast.success).toHaveBeenCalledWith("Imported 12 templates", undefined);
  });

  it("clears the slot on demand", () => {
    actionToasts("import").dismiss();

    expect(sonner.toast.dismiss).toHaveBeenCalledWith("import");
  });
});
