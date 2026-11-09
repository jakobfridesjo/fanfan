import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "vitest-browser-react";
import { IconButtonTooltip } from "@/shared/ui/TooltipIconButton.tsx";
import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/shared/ui/shadcn/sidebar.tsx";
import { Toaster } from "@/shared/ui/Toaster.tsx";
import { createTestQueryClient } from "@/shared/test/query.tsx";

/** Render a page with the query client and sidebar context supplied by the app shell. */
export async function renderPage(
  ui: ReactNode,
  queryClient: QueryClient = createTestQueryClient()
) {
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <SidebarInset>{ui}</SidebarInset>
      </SidebarProvider>
      <IconButtonTooltip />
      <Toaster />
    </QueryClientProvider>
  );

  return { ...view, queryClient };
}

/** `renderPage` under a router whose only route is `ui`; navigation shows up in `router.state.location`. */
export async function renderPageInRouter(
  ui: ReactNode,
  {
    initialPath = "/",
    queryClient = createTestQueryClient(),
  }: { initialPath?: string; queryClient?: QueryClient } = {}
) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui, notFoundComponent: () => null }),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  await router.load();
  const view = await renderPage(<RouterProvider router={router} />, queryClient);

  return { ...view, router };
}
