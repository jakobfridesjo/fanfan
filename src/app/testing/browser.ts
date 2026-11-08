import { afterEach } from "vitest";
import { cleanup } from "vitest-browser-react";
import { clearMocks } from "@tauri-apps/api/mocks";
import { toast } from "sonner";
import "@/app/styles/globals.css";
import "@/app/testing/no-motion.css";

// Unmount before dropping the test's command mocks, or a still-mounted
// component's refetch lands in the gap and reaches no handler.
afterEach(async () => {
  await cleanup();
  // Sonner replays still-active toasts to the next Toaster; sticky ones would cover the next test.
  toast.dismiss();
  clearMocks();
});
