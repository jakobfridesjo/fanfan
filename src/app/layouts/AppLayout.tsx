import { useState, type CSSProperties, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/shared/ui/shadcn/sidebar.tsx";
import { AppSidebar } from "@/app/layouts/Sidebar.tsx";
import { getSidebarDefaultOpen } from "@/app/layouts/sidebar-default-open.ts";
import { PageBackground } from "@/app/layouts/PageBackground.tsx";
import { BottomNav } from "@/app/layouts/BottomNav.tsx";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";
import { ModelDownloadDialog } from "@/shared/ui/ModelDownloadDialog.tsx";

const SIDEBAR_STYLE = {
  "--sidebar-width": "13rem",
  "--sidebar-width-icon": "3rem",
} as CSSProperties;

function AppLayout({ children }: { children: ReactNode }) {
  const [defaultOpen] = useState(getSidebarDefaultOpen);
  const isMobile = useIsMobile();

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={SIDEBAR_STYLE}
      className="relative isolate h-svh"
    >
      <PageBackground />
      {!isMobile && <AppSidebar />}
      <SidebarInset className="relative z-0 min-h-0 min-w-0 overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        <div className="min-h-0 flex-1">{children}</div>
        {isMobile && <BottomNav />}
      </SidebarInset>
      <ModelDownloadDialog />
    </SidebarProvider>
  );
}

export default AppLayout;
