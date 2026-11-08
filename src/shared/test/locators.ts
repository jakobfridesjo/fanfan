import { page, type Locator } from "vitest/browser";

export function rowContaining(locator: Locator): Locator {
  return page.getByRole("row").filter({ has: locator });
}
