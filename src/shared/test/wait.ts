import { vi } from "vitest";

export function waitFor<T>(callback: () => T | Promise<T>): Promise<T> {
  return vi.waitFor(callback, { timeout: 5_000 });
}
