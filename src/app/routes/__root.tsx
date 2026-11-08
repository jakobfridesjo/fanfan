import React, { lazy, Suspense } from "react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemePreferenceProvider } from "@/app/providers/ThemeContext.tsx";
import { useThemePreference } from "@/app/providers/theme-context.ts";
import { Toaster } from "@/shared/ui/Toaster.tsx";
import type { AppRouterContext } from "@/app/router-context.ts";
import {
  AppCrashFallback,
  NotFoundFallback,
  RouteErrorFallback,
} from "@/app/layouts/RouteFallbacks.tsx";

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
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});

function AppToaster() {
  const { themeMode } = useThemePreference();

  return <Toaster theme={themeMode} />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemePreferenceProvider>
          <Outlet />
          <AppToaster />
        </ThemePreferenceProvider>
        {AppDevtools ? (
          <Suspense fallback={null}>
            <AppDevtools />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
