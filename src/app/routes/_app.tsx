import { createFileRoute, Outlet } from "@tanstack/solid-router";
import AppLayout from "@/app/layouts/AppLayout.tsx";

// Pathless layout: every route under `_app/` renders inside the sidebar shell.
export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  return (
    <AppLayout>
      <div class="flex h-full flex-col px-5 pt-3 pb-5">
        <Outlet />
      </div>
    </AppLayout>
  );
}
