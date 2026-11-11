import { beforeEach } from "vitest";
import { userEvent } from "vitest/browser";
import { resetModelDownloads } from "@/shared/api/model-downloads.ts";
import { resetPreferences } from "@/shared/config/preferences.ts";

// Test files share one page, so module-level state outlives the file that set it.
// Reset global stores here. Kept out of browser.ts: importing app modules there
// would load them before an isolated file's `vi.mock` could replace them.
beforeEach(async () => {
  await userEvent.unhover(document.body);
  resetPreferences();
  resetModelDownloads();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});
