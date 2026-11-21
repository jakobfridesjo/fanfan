import { createEffect, createMemo } from "solid-js";
import { dismissToast, toastError } from "@/shared/lib/toast.ts";

export function useQueryErrorToast(message: () => string | null, id: string) {
  const shown = createMemo(message);
  createEffect(shown, (text) => {
    if (!text) return;

    toastError(text, { id });
    return () => dismissToast(id);
  });
}
