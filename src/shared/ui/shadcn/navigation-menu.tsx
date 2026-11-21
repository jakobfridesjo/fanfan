import type { JSX } from "@solidjs/web";
import { Link, type LinkProps } from "@tanstack/solid-router";
import { cn } from "@/shared/lib/class-names.ts";

function NavigationMenu(props: { "aria-label"?: string; class?: string; children: JSX.Element }) {
  return (
    <nav
      data-slot="navigation-menu"
      aria-label={props["aria-label"]}
      class={cn("relative flex flex-1 items-center justify-center", props.class)}
    >
      {props.children}
    </nav>
  );
}

function NavigationMenuList(props: { class?: string; children: JSX.Element }) {
  return (
    <ul
      data-slot="navigation-menu-list"
      class={cn("flex flex-1 list-none items-center justify-center gap-0", props.class)}
    >
      {props.children}
    </ul>
  );
}

function NavigationMenuItem(props: { class?: string; children: JSX.Element }) {
  return (
    <li data-slot="navigation-menu-item" class={cn("relative", props.class)}>
      {props.children}
    </li>
  );
}

/** A router link styled as a menu entry; `active` marks the page on show. */
function NavigationMenuLink(props: {
  to: LinkProps["to"];
  active: boolean;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <Link
      to={props.to}
      data-slot="navigation-menu-link"
      data-active={props.active ? "" : undefined}
      aria-current={props.active ? "page" : undefined}
      class={cn(
        "flex items-center gap-2 rounded-2xl px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-1 data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted [&_svg:not([class*='size-'])]:size-4",
        props.class
      )}
    >
      {props.children}
    </Link>
  );
}

export { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList };
