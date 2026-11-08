import { createRouter } from "@tanstack/react-router";
import { createQueryClient } from "@/shared/api/query-client.ts";
import { routeTree } from "@/app/routeTree.gen.ts";
import { NotFoundFallback, RouteErrorFallback } from "@/app/layouts/RouteFallbacks.tsx";

const queryClient = createQueryClient();

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  defaultPendingMs: 0,
  defaultPendingMinMs: 0,
  context: {
    queryClient,
  },
  defaultErrorComponent: RouteErrorFallback,
  defaultNotFoundComponent: NotFoundFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
