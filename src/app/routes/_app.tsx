import { createFileRoute, Outlet } from "@tanstack/react-router";
import AppLayout from "@/app/layouts/AppLayout.tsx";
import PageLayout from "@/app/layouts/PageLayout.tsx";

// Pathless layout: every route under `_app/` renders inside the sidebar shell.
// Add a `beforeLoad` here to gate the app behind a session check.
export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  return (
    <AppLayout>
      <PageLayout>
        <Outlet />
      </PageLayout>
    </AppLayout>
  );
}
