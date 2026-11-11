import { toast } from "sonner";

// Errors and warnings stay up until dismissed.
const sticky = { duration: Number.POSITIVE_INFINITY } as const;

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  id?: string;
  description?: string;
  action?: ToastAction;
}

export function toastError(message: string, options?: ToastOptions) {
  toast.error(message, { ...sticky, ...options });
}

function toastWarning(message: string, options?: ToastOptions) {
  toast.warning(message, { ...sticky, ...options });
}

export function toastSuccess(message: string, options?: ToastOptions) {
  toast.success(message, options);
}

function toastInfo(message: string, options?: ToastOptions) {
  toast.info(message, options);
}

/** A toast that stays up while something runs; call again with the same `id` to update it. */
export function toastLoading(message: string, options: ToastOptions & { id: string }) {
  toast.loading(message, { ...sticky, ...options });
}

export function dismissToast(id: string) {
  toast.dismiss(id);
}

interface ActionToasts {
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  /** A neutral outcome: nothing failed, but nothing changed either. */
  info: (message: string, options?: ToastOptions) => void;
  dismiss: () => void;
}

/**
 * One toast slot for a retryable action (save, delete, import).
 */
export function actionToasts(id: string): ActionToasts {
  return {
    error: (message, options) => toastError(message, { ...options, id }),
    warning: (message, options) => toastWarning(message, { ...options, id }),
    success: (message, options) => {
      dismissToast(id);
      toastSuccess(message, options);
    },
    info: (message, options) => {
      dismissToast(id);
      toastInfo(message, options);
    },
    dismiss: () => dismissToast(id),
  };
}
