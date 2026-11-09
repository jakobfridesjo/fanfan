import { Link, useMatchRoute } from "@tanstack/react-router";
import { Info, Moon, Settings, SlidersHorizontal, Sun, SunMoon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/shadcn/dropdown-menu.tsx";
import { SidebarMenuButton, useSidebar } from "@/shared/ui/shadcn/sidebar.tsx";
import { useMessages } from "@/shared/i18n/messages.ts";
import { useSelector } from "@tanstack/react-store";
import { THEMES, themeAtom } from "@/shared/config/preferences.ts";

const themeOptions = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "auto", icon: SunMoon },
] as const;

export function SettingsMenu() {
  const m = useMessages();
  const matchRoute = useMatchRoute();
  const { isMobile, setOpenMobile } = useSidebar();
  const theme = useSelector(themeAtom);

  const selectTheme = (next: string) => {
    const selected = THEMES.find((value) => value === next);
    if (selected) {
      themeAtom.set(selected);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            isActive={matchRoute({ to: "/settings" }) !== false}
            tooltip={m.nav.settings}
            className="h-8 w-full cursor-pointer px-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&_svg]:size-4"
          />
        }
      >
        <Settings className="size-4 shrink-0" />
        <span className="truncate group-data-[collapsible=icon]:hidden">{m.nav.settings}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-max min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m.nav.theme}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={selectTheme}>
            {themeOptions.map(({ value, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon />
                {m.nav.themes[value]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link to="/settings" />}
          onClick={() => {
            if (isMobile) {
              setOpenMobile(false);
            }
          }}
        >
          <SlidersHorizontal />
          {m.nav.allSettings}
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<Link to="/about" />}
          onClick={() => {
            if (isMobile) {
              setOpenMobile(false);
            }
          }}
        >
          <Info />
          {m.nav.about}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
