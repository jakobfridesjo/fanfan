import type { ValueStorage } from "@/shared/lib/persisted-value.ts";

/** An in-memory `ValueStorage`, so persistence tests need no DOM. */
export function createFakeStorage(initial: Record<string, string> = {}): ValueStorage {
  const values = new Map(Object.entries(initial));

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
