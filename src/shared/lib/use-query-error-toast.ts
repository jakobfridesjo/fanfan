import { useEffect } from "react";
import { dismissToast, toastError } from "@/shared/lib/toast.ts";

export function useQueryErrorToast(message: string | null, id: string) {
  useEffect(() => {
    if (!message) return;

    toastError(message, { id });
    return () => dismissToast(id);
  }, [message, id]);
}
