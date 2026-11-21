import { useRouter, type RouterHistory } from "@tanstack/solid-router";
import { createSignal, type Accessor } from "solid-js";
import type * as z from "zod/mini";

/**
 * A signal that also writes into the current history entry, so Back restores
 * it while a fresh visit starts from `initial`. Without a router it is a plain signal.
 */
export function useHistoryState<T>(
  key: string,
  schema: z.ZodMiniType<T>,
  initial: T | (() => T)
): [Accessor<T>, (next: T | ((current: T) => T)) => void] {
  const router = useRouter({ warn: false }) as { history: RouterHistory } | undefined;
  const stored = schema.safeParse(
    (router?.history.location.state as Record<string, unknown> | undefined)?.[key]
  );
  let current: T = stored.success
    ? stored.data
    : typeof initial === "function"
      ? (initial as () => T)()
      : initial;
  const [value, setValue] = createSignal<unknown>(current);

  const set = (next: T | ((current: T) => T)) => {
    current = typeof next === "function" ? (next as (current: T) => T)(current) : next;
    setValue(() => current);
    const history = router?.history;
    if (!history) return;
    const { href, state } = history.location;
    if ((state as unknown as Record<string, unknown>)[key] === current) return;
    history.replace(href, { ...state, [key]: current });
  };

  return [value as Accessor<T>, set];
}
