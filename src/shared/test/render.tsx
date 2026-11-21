import type { JSX } from "@solidjs/web";
import { QueryClientProvider, type QueryClient } from "@tanstack/solid-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/solid-router";
import { SidebarInset, SidebarProvider } from "@/shared/ui/shadcn/sidebar.tsx";
import { ModelDownloadDialog } from "@/shared/ui/ModelDownloadDialog.tsx";
import { Toaster } from "@/shared/ui/Toaster.tsx";
import { createTestQueryClient } from "@/shared/test/query.tsx";
import { render } from "@/shared/test/solid.ts";

/** Render a page with the query client, sidebar context and overlays supplied by the app shell. */
export function renderPage(
  ui: () => JSX.Element,
  queryClient: QueryClient = createTestQueryClient()
) {
  const view = render(() => (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <SidebarInset>{ui()}</SidebarInset>
      </SidebarProvider>
      <ModelDownloadDialog />
      <Toaster />
    </QueryClientProvider>
  ));

  return { ...view, queryClient };
}

/** `renderPage` under a router whose only route is `ui`; navigation shows up in `router.state.location`. */
export async function renderPageInRouter(
  ui: () => JSX.Element,
  {
    initialPath = "/",
    queryClient = createTestQueryClient(),
  }: { initialPath?: string; queryClient?: QueryClient } = {}
) {
  const router = createRouter({
    routeTree: createRootRoute({ component: ui, notFoundComponent: () => null }),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  await router.load();
  const view = renderPage(() => <RouterProvider router={router} />, queryClient);

  return { ...view, router };
}
