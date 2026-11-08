import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createQueryClient } from "@/shared/api/query-client.ts";
import { renderHook } from "vitest-browser-react";
import type { ReactNode } from "react";
import { Toaster } from "@/shared/ui/Toaster.tsx";

/**
 * A client that fails fast: retries would turn an asserted rejection into a
 * multi-second timeout. Isolation comes from a fresh client per render, so the
 * cache keeps its normal lifetime and `setQueryData` written by a mutation's
 * `onSuccess` is still there to assert on.
 */
export function createTestQueryClient() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  return client;
}

/**
 * Render a hook that needs a QueryClient. Pass a client in to share one across
 * several renders — e.g. to assert that a mutation invalidated a live query.
 */
export async function renderQueryHook<Result, Props = undefined>(
  hook: (initialProps?: Props) => Result,
  { queryClient = createTestQueryClient(), initialProps }: RenderQueryHookOptions<Props> = {}
) {
  const view = await renderHook(hook, {
    initialProps,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    ),
  });

  return { ...view, queryClient };
}

interface RenderQueryHookOptions<Props> {
  queryClient?: QueryClient;
  initialProps?: Props;
}

export function runMutation<Args, Data>(
  mutation: { mutateAsync: (args: Args) => Promise<Data> },
  args: Args
): Promise<Data> {
  return mutation.mutateAsync(args);
}

/** `runMutation` for the rejecting case: returns the thrown reason. */
export async function runFailingMutation<Args>(
  mutation: { mutateAsync: (args: Args) => Promise<unknown> },
  args: Args
): Promise<Error> {
  return mutation.mutateAsync(args).then(
    () => {
      throw new Error("Expected the mutation to reject");
    },
    (cause: unknown) => cause as Error
  );
}
