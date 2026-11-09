import React, { lazy, Suspense, useEffect } from "react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { syncThemeClass, themeModeAtom } from "@/app/providers/theme-mode.ts";
import { Toaster } from "@/shared/ui/Toaster.tsx";
import { IconButtonTooltip } from "@/shared/ui/TooltipIconButton.tsx";
import type { AppRouterContext } from "@/app/router-context.ts";
import { AppCrashFallback } from "@/app/layouts/RouteFallbacks.tsx";

const AppDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("@/app/devtools/AppDevtools.tsx");
      return { default: module.AppDevtools };
    })
  : null;

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <AppCrashFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
});

function AppToaster() {
  const themeMode = useSelector(themeModeAtom);

  return <Toaster theme={themeMode} />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(syncThemeClass, []);

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <IconButtonTooltip />
        <AppToaster />
        {AppDevtools ? (
          <Suspense fallback={null}>
            <AppDevtools />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
