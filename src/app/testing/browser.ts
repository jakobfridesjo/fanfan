import { afterEach } from "vitest";
import { clearMocks } from "@tauri-apps/api/mocks";
import { toast } from "solid-sonner";
import { cleanup } from "@/shared/test/solid.ts";
import "@/app/styles/globals.css";
import "@/app/testing/no-motion.css";

// Unmount before dropping the test's command mocks, or a still-mounted
// component's refetch lands in the gap and reaches no handler.
afterEach(() => {
  cleanup();
  // Sonner replays still-active toasts to the next Toaster; sticky ones would cover the next test.
  toast.dismiss();
  clearMocks();
});
