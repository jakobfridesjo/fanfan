import { useRouter, type RouterHistory } from "@tanstack/react-router";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type * as z from "zod/mini";

/**
 * `useState` that also writes into the current history entry, so Back restores
 * it while a fresh visit starts from `initial`. Without a router it is plain state.
 */
export function useHistoryState<T>(
  key: string,
  schema: z.ZodMiniType<T>,
  initial: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const router = useRouter({ warn: false }) as { history: RouterHistory } | undefined;
  const [value, setValue] = useState<T>(() => {
    const stored = schema.safeParse(
      (router?.history.location.state as Record<string, unknown> | undefined)?.[key]
    );
    if (stored.success) return stored.data;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    const history = router?.history;
    if (!history) return;
    const { href, state } = history.location;
    if ((state as unknown as Record<string, unknown>)[key] === value) return;
    history.replace(href, { ...state, [key]: value });
  }, [router, key, value]);

  return [value, setValue];
}
