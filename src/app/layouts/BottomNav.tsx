import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/shared/ui/shadcn/navigation-menu.tsx";
import { Separator } from "@/shared/ui/shadcn/separator.tsx";
import { useMessages } from "@/shared/i18n/messages.ts";
import { settingsNavItem, studyNavItems } from "@/app/layouts/nav-items.ts";

const navItems = [...studyNavItems, settingsNavItem];

/** Phone navigation: a tab bar, hidden on the full-screen reader and deck. */
export function BottomNav() {
  const m = useMessages();
  const matchRoute = useMatchRoute();

  const fullScreen =
    matchRoute({ to: "/read/$documentId" }) !== false ||
    matchRoute({ to: "/library/$documentId" }) !== false;
  if (fullScreen) {
    return null;
  }

  return (
    <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">
      <Separator />
      <NavigationMenu className="max-w-none">
        <NavigationMenuList className="gap-1 px-2 py-1">
          {navItems.map(({ label, link, icon: Icon, fuzzy = false }) => (
            <NavigationMenuItem key={label} className="min-w-0 flex-1">
              <NavigationMenuLink
                active={matchRoute({ ...link, fuzzy }) !== false}
                render={<Link {...link} />}
                className="w-full flex-col justify-center gap-0.5 px-1 py-1.5 text-xs [&_svg]:size-5!"
              >
                <Icon />
                <span className="max-w-full truncate">{m.nav[label]}</span>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
