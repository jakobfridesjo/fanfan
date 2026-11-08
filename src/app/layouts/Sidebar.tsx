import { useEffect } from "react";
import { Link, useLocation, useMatchRoute, type LinkProps } from "@tanstack/react-router";
import { AppLogo } from "@/app/layouts/AppLogo.tsx";
import { ChartColumn, GraduationCap, Library, ListChecks, type LucideIcon } from "lucide-react";
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
  useSidebar,
} from "@/shared/ui/shadcn/sidebar.tsx";
import { useMessages } from "@/shared/i18n/messages.ts";
import type { Messages } from "@/shared/i18n/messages-en.ts";
import { SettingsMenu } from "@/app/layouts/SettingsMenu.tsx";

type NavLabel = Exclude<keyof Messages["nav"], "settings" | "theme" | "allSettings" | "themes">;

interface NavItem {
  label: NavLabel;
  /** Where the entry navigates. Also its active-state check — see `renderItem`. */
  link: LinkProps;
  icon: LucideIcon;
  fuzzy?: boolean;
}

interface NavGroup {
  label: NavLabel;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "study",
    items: [
      { label: "library", link: { to: "/library" }, icon: Library, fuzzy: true },
      { label: "review", link: { to: "/review" }, icon: GraduationCap },
      { label: "knownWords", link: { to: "/known-words" }, icon: ListChecks },
      { label: "statistics", link: { to: "/statistics" }, icon: ChartColumn },
    ],
  },
];

export function AppSidebar() {
  const pathname = useLocation({ select: (loc) => loc.pathname });
  const matchRoute = useMatchRoute();
  const { isMobile, setOpenMobile } = useSidebar();
  const m = useMessages();

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, pathname, setOpenMobile]);

  // Active state comes from the router matching the entry's own link, so a
  // parameterised route needs no second, hand-written copy of its pathname.
  const renderItem = ({ label, link, icon: Icon, fuzzy = false }: NavItem) => (
    <SidebarMenuItem key={label} className="my-0.5">
      <SidebarMenuButton
        isActive={matchRoute({ ...link, fuzzy }) !== false}
        tooltip={m.nav[label]}
        render={<Link {...link} />}
        className="h-8 px-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&_svg]:size-4"
        onClick={() => {
          if (isMobile) {
            setOpenMobile(false);
          }
        }}
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
                App Template
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SettingsMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
