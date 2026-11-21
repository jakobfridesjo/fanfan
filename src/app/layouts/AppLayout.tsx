import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { SidebarInset, SidebarProvider } from "@/shared/ui/shadcn/sidebar.tsx";
import { AppSidebar } from "@/app/layouts/Sidebar.tsx";
import { getSidebarDefaultOpen } from "@/app/layouts/sidebar-default-open.ts";
import { PageBackground } from "@/app/layouts/PageBackground.tsx";
import { BottomNav } from "@/app/layouts/BottomNav.tsx";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";
import { ModelDownloadDialog } from "@/shared/ui/ModelDownloadDialog.tsx";

const SIDEBAR_STYLE = { "--sidebar-width": "13rem", "--sidebar-width-icon": "3rem" };

function AppLayout(props: { children: JSX.Element }) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider
      defaultOpen={getSidebarDefaultOpen()}
      style={SIDEBAR_STYLE}
      class="relative isolate h-svh"
    >
      <PageBackground />
      <Show when={!isMobile()}>
        <AppSidebar />
      </Show>
      <SidebarInset class="relative z-0 min-h-0 min-w-0 overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        <div class="min-h-0 flex-1">{props.children}</div>
        <Show when={isMobile()}>
          <BottomNav />
        </Show>
      </SidebarInset>
      <ModelDownloadDialog />
    </SidebarProvider>
  );
}

export default AppLayout;
