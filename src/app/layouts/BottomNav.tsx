import { useMatchRoute } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/shared/ui/shadcn/navigation-menu.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Separator } from "@/shared/ui/shadcn/separator.tsx";
import { useMessages } from "@/shared/i18n/messages.ts";
import { settingsNavItem, studyNavItems, type NavItem } from "@/app/layouts/nav-items.ts";

const navItems = [...studyNavItems, settingsNavItem];

function NavTab(props: { item: NavItem }) {
  const m = useMessages();
  const matchRoute = useMatchRoute();
  const item = props.item;
  const active = matchRoute({ to: item.to, fuzzy: item.fuzzy ?? false });

  return (
    <NavigationMenuItem class="min-w-0 flex-1">
      <NavigationMenuLink
        to={item.to}
        active={active() !== false}
        class="w-full flex-col justify-center gap-0.5 px-1 py-1.5 text-xs [&_svg]:size-5!"
      >
        <Icon icon={item.icon} />
        <span class="max-w-full truncate">{m.nav[item.label]}</span>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

/** Phone navigation: a tab bar, hidden on the full-screen reader and deck. */
export function BottomNav() {
  const matchRoute = useMatchRoute();
  const reading = matchRoute({ to: "/read/$documentId" });
  const studying = matchRoute({ to: "/library/$documentId" });

  return (
    <Show when={reading() === false && studying() === false}>
      <div class="shrink-0 pb-[env(safe-area-inset-bottom)]">
        <Separator />
        <NavigationMenu class="max-w-none">
          <NavigationMenuList class="gap-1 px-2 py-1">
            <For each={navItems}>{(item) => <NavTab item={item} />}</For>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </Show>
  );
}
