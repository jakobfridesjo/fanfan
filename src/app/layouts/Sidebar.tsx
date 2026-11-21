import { useMatchRoute } from "@tanstack/solid-router";
import { For } from "solid-js";
import { AppLogo } from "@/shared/ui/AppLogo.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
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

function NavEntry(props: { item: NavItem }) {
  const matchRoute = useMatchRoute();
  const m = useMessages();
  const item = props.item;
  const active = matchRoute({ to: item.to, fuzzy: item.fuzzy ?? false });

  return (
    <SidebarMenuItem class="my-0.5">
      <SidebarMenuLink
        to={item.to}
        active={active() !== false}
        tooltip={m.nav[item.label]}
        class="px-2"
      >
        <Icon icon={item.icon} />
        <span>{m.nav[item.label]}</span>
      </SidebarMenuLink>
    </SidebarMenuItem>
  );
}

/** Desktop navigation; phones get `BottomNav` instead. */
export function AppSidebar() {
  const m = useMessages();

  return (
    <Sidebar>
      <SidebarHeader class="pt-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <div class="group/logo relative flex items-center gap-2">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-md">
                <AppLogo class="size-5 shrink-0 group-data-[collapsible=icon]:group-has-[[data-sidebar=trigger]:is(:hover,:focus-visible)]/logo:opacity-0" />
              </div>
              <span class="flex-1 -translate-y-px truncate text-[0.9375rem] font-semibold group-data-[collapsible=icon]:hidden">
                翻翻
              </span>
              <SidebarTrigger
                label={m.nav.toggleSidebar}
                class="shrink-0 group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:transition-none group-data-[collapsible=icon]:hover:opacity-100 group-data-[collapsible=icon]:focus-visible:opacity-100"
              />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <For each={navGroups}>
          {(group) => (
            <SidebarGroup class="px-2">
              <SidebarGroupLabel>{m.nav[group.label]}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <For each={group.items}>{(item) => <NavEntry item={item} />}</For>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </For>
      </SidebarContent>

      <SidebarFooter class="px-2">
        <SidebarMenu>
          <NavEntry item={settingsNavItem} />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
