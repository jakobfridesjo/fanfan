import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { routeTree } from "@/app/routeTree.gen.ts";
import type { AppRouterContext } from "@/app/router-context.ts";
import { NotFoundFallback, RouteErrorFallback } from "@/app/layouts/RouteFallbacks.tsx";

/** The app's router: `main.tsx` makes the one the app runs, tests theirs with a memory history. */
export function createAppRouter(context: AppRouterContext, history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    context,
    defaultErrorComponent: RouteErrorFallback,
    defaultNotFoundComponent: NotFoundFallback,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
