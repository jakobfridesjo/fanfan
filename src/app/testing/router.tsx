import { render } from "vitest-browser-react";
import type { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import type { AppRouterContext } from "@/app/router-context.ts";
import { routeTree } from "@/app/routeTree.gen.ts";
import { createTestQueryClient } from "@/shared/test/query.tsx";

interface RenderRouteOptions {
  queryClient?: QueryClient;
}

/** Renders the real route tree at `initialPath`; commands go through `mockCommands`. */
export async function renderRoute(initialPath: string, options: RenderRouteOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const context: AppRouterContext = { queryClient };

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context,
  });

  const result = await render(<RouterProvider router={router} context={context} />);

  return { ...result, router };
}
