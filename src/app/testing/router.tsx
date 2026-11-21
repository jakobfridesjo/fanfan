import type { QueryClient } from "@tanstack/solid-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/solid-router";
import type { AppRouterContext } from "@/app/router-context.ts";
import { createAppRouter } from "@/app/router.tsx";
import { createTestQueryClient } from "@/shared/test/query.tsx";
import { render } from "@/shared/test/solid.ts";

interface RenderRouteOptions {
  queryClient?: QueryClient;
}

/** Renders the real route tree at `initialPath`; commands go through `mockCommands`. */
export function renderRoute(initialPath: string, options: RenderRouteOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const context: AppRouterContext = { queryClient };
  const router = createAppRouter(context, createMemoryHistory({ initialEntries: [initialPath] }));

  const result = render(() => <RouterProvider router={router} context={context} />);

  return { ...result, router };
}
