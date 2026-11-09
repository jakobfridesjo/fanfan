import { Link, useMatchRoute } from "@tanstack/react-router";
import { AppLogo } from "@/shared/ui/AppLogo.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/shared/ui/shadcn/sidebar.tsx";
import { useMessages } from "@/shared/i18n/messages.ts";
import {
  settingsNavItem,
  studyNavItems,
  type NavItem,
  type NavLabel,
} from "@/app/layouts/nav-items.ts";

interface NavGroup {
  label: NavLabel;
  items: NavItem[];
}

const navGroups: NavGroup[] = [{ label: "study", items: studyNavItems }];

const menuButtonClassName =
  "h-8 px-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&_svg]:size-4";

/** Desktop navigation; phones get `BottomNav` instead. */
export function AppSidebar() {
  const matchRoute = useMatchRoute();
  const m = useMessages();

  const renderItem = ({ label, link, icon: Icon, fuzzy = false }: NavItem) => (
    <SidebarMenuItem key={label} className="my-0.5">
      <SidebarMenuButton
        isActive={matchRoute({ ...link, fuzzy }) !== false}
        tooltip={m.nav[label]}
        render={<Link {...link} />}
        className={menuButtonClassName}
      >
        <Icon />
        <span>{m.nav[label]}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="pt-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="group/logo relative flex items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md">
                <AppLogo className="size-5 shrink-0 group-data-[collapsible=icon]:group-has-[[data-sidebar=trigger]:is(:hover,:focus-visible)]/logo:opacity-0" />
              </div>
              <span className="flex-1 -translate-y-px truncate text-[0.9375rem] font-semibold group-data-[collapsible=icon]:hidden">
                翻翻
              </span>
              <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:transition-none group-data-[collapsible=icon]:hover:opacity-100 group-data-[collapsible=icon]:focus-visible:opacity-100" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map(({ label, items }) => (
          <SidebarGroup key={label} className="px-2">
            <SidebarGroupLabel>{m.nav[label]}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{items.map((item) => renderItem(item))}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-2">
        <SidebarMenu>{renderItem(settingsNavItem)}</SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
