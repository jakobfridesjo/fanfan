import { page as screen } from "vitest/browser";
import { render } from "vitest-browser-react";
import { describe, expect, it, vi } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AppCrashFallback, RouteErrorFallback } from "@/app/layouts/RouteFallbacks.tsx";

function renderFailingRoute(loader: () => Promise<void>) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    loader,
    component: () => <div>Page loaded</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultErrorComponent: RouteErrorFallback,
  });

  return render(<RouterProvider router={router} />);
}

describe("RouteErrorFallback", () => {
  it("shows the error state and re-runs the loader on retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const loader = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(undefined);

    await renderFailingRoute(loader);

    await expect.element(screen.getByText("Something went wrong")).toBeVisible();

    await screen.getByRole("button", { name: "Try again" }).click();

    await expect.element(screen.getByText("Page loaded")).toBeVisible();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe("AppCrashFallback", () => {
  it("offers a reload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await render(<AppCrashFallback error={new Error("boom")} />);

    await expect.element(screen.getByRole("button", { name: "Reload" })).toBeVisible();
  });
});
