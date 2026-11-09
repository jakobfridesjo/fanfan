import { MutationCache, QueryClient } from "@tanstack/react-query";
import { invalidateStudyData } from "@/shared/api/queries.ts";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** The mutation changes word statuses: refresh every query that shows them once it settles. */
      changesStudyData?: true;
    };
  }
}

// Commands run in-process against a local database: a failure is a real error,
// not a flaky network, so retrying only delays the message.
export function createQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      // Awaited before the mutation's own `onSettled`, so that sees the refetched data.
      onSettled: (_data, _error, _variables, _result, mutation, { client }) =>
        mutation.meta?.changesStudyData ? invalidateStudyData(client) : undefined,
    }),
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });
}
