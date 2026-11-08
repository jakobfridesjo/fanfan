import { QueryClient } from "@tanstack/react-query";

// Commands run in-process against a local database: a failure is a real error,
// not a flaky network, so retrying only delays the message.
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
