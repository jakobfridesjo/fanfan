import { render } from "vitest-browser-react";
import type { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import type { AppRouterContext } from "@/app/router-context.ts";
import { createAppRouter } from "@/app/router.tsx";
import { createTestQueryClient } from "@/shared/test/query.tsx";

interface RenderRouteOptions {
  queryClient?: QueryClient;
}

/** Renders the real route tree at `initialPath`; commands go through `mockCommands`. */
export async function renderRoute(initialPath: string, options: RenderRouteOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const context: AppRouterContext = { queryClient };
  const router = createAppRouter(context, createMemoryHistory({ initialEntries: [initialPath] }));

  const result = await render(<RouterProvider router={router} context={context} />);

  return { ...result, router };
}
