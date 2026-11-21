import { Errored, lazy, Loading, Show, untrack } from "solid-js";
import { createRootRouteWithContext, Outlet } from "@tanstack/solid-router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { themeModeAtom } from "@/app/providers/theme-mode.ts";
import { Toaster } from "@/shared/ui/Toaster.tsx";
import type { AppRouterContext } from "@/app/router-context.ts";
import { AppCrashFallback } from "@/app/layouts/RouteFallbacks.tsx";

const AppDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("@/app/devtools/AppDevtools.tsx");
      return { default: module.AppDevtools };
    })
  : null;

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  // The router is made with its query client, and keeps it.
  const queryClient = untrack(Route.useRouteContext()).queryClient;

  return (
    <Errored fallback={(error) => <AppCrashFallback error={error()} />}>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster theme={themeModeAtom()} />
        <Show when={AppDevtools}>
          {(Devtools) => (
            <Loading>
              {(() => {
                const Loaded = Devtools();
                return <Loaded />;
              })()}
            </Loading>
          )}
        </Show>
      </QueryClientProvider>
    </Errored>
  );
}
