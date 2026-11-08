import { useState, type CSSProperties, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/shared/ui/shadcn/sidebar.tsx";
import { AppSidebar } from "@/app/layouts/Sidebar.tsx";
import { getSidebarDefaultOpen } from "@/app/layouts/sidebar-default-open.ts";
import { PageBackground } from "@/app/layouts/PageBackground.tsx";

const SIDEBAR_STYLE = {
  "--sidebar-width": "13rem",
  "--sidebar-width-icon": "3rem",
} as CSSProperties;

function AppLayout({ children }: { children: ReactNode }) {
  const [defaultOpen] = useState(getSidebarDefaultOpen);

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={SIDEBAR_STYLE}
      className="relative isolate h-svh"
    >
      <PageBackground />
      <AppSidebar />
      <SidebarInset className="relative z-0 min-h-0 min-w-0 overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export default AppLayout;
