import { createQueryClient } from "@/shared/api/query-client.ts";

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
