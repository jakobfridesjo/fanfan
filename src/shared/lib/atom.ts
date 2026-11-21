import { createSignal, type Accessor } from "solid-js";

/**
 * State kept outside the components. Called, it is a signal: `atom()` in JSX, a memo or an
 * effect follows it. A signal shows a write only after Solid's next flush, so code outside
 * the components, which reads what it has just written, uses `get`.
 */
export interface Atom<T> extends Accessor<T> {
  /** The value now, a write made this instant included; tracks nothing. */
  get: () => T;
  set: (next: T | ((current: T) => T)) => void;
  /** Calls `listener` with each new value as it is set; returns how to stop. */
  subscribe: (listener: (value: T) => void) => () => void;
}

export function createAtom<T>(initial: T): Atom<T> {
  let current = initial;
  const listeners = new Set<(value: T) => void>();
  // Atoms are set from anywhere, effects and component bodies included.
  const [tracked, setTracked] = createSignal<unknown>(initial, { ownedWrite: true });
  return Object.assign(tracked as Accessor<T>, {
    get: () => current,
    set: (next: T | ((current: T) => T)) => {
      const value = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      if (Object.is(value, current)) return;
      current = value;
      setTracked(() => value);
      for (const listener of listeners) listener(value);
    },
    subscribe: (listener: (value: T) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  });
}
