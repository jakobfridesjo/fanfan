import type { JSX } from "@solidjs/web";
import { createContext, createSignal, onSettled, useContext } from "solid-js";
import { Link, type LinkProps } from "@tanstack/solid-router";
import { PanelLeft } from "lucide";
import { cn } from "@/shared/lib/class-names.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/shadcn/tooltip.tsx";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarState {
  open: () => boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarState>({ open: () => true, toggle: () => {} });

function SidebarProvider(props: {
  defaultOpen?: boolean;
  style?: JSX.CSSProperties;
  class?: string;
  children: JSX.Element;
}) {
  const [open, setOpen] = createSignal(() => props.defaultOpen ?? true);
  let latest: boolean | undefined;
  const toggle = () => {
    latest = !(latest ?? open());
    setOpen(latest);
    // Kept so the sidebar opens the next time as it was left.
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${latest}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
  };

  onSettled(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== SIDEBAR_KEYBOARD_SHORTCUT || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <SidebarContext value={{ open, toggle }}>
      <div
        data-slot="sidebar-wrapper"
        style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem", ...props.style }}
        class={cn(
          "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
          props.class
        )}
      >
        {props.children}
      </div>
    </SidebarContext>
  );
}

/** The desktop sidebar: inset beside the page, collapsing to a strip of icons. */
function Sidebar(props: { children: JSX.Element }) {
  const sidebar = useContext(SidebarContext);
  return (
    <div
      class="group peer hidden text-sidebar-foreground md:block"
      data-state={sidebar.open() ? "expanded" : "collapsed"}
      data-collapsible={sidebar.open() ? "" : "icon"}
      data-variant="inset"
      data-side="left"
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-gap"
        class="relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
      />
      <div
        data-slot="sidebar-container"
        class="fixed inset-y-0 left-0 z-10 hidden h-svh w-(--sidebar-width) p-2 transition-[left,right,width] duration-200 ease-linear group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)] md:flex"
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          class="flex size-full flex-col bg-sidebar"
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}

function SidebarTrigger(props: { label: string; class?: string }) {
  const sidebar = useContext(SidebarContext);
  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      class={props.class}
      onClick={() => sidebar.toggle()}
    >
      <Icon icon={PanelLeft} />
      <span class="sr-only">{props.label}</span>
    </Button>
  );
}

function SidebarInset(props: { class?: string; children: JSX.Element }) {
  return (
    <main
      data-slot="sidebar-inset"
      class={cn(
        "relative flex w-full flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        props.class
      )}
    >
      {props.children}
    </main>
  );
}

interface SlotProps {
  class?: string;
  children: JSX.Element;
}

function SidebarHeader(props: SlotProps) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      class={cn("flex flex-col gap-2 p-2 [--radius:var(--radius-xl)]", props.class)}
    >
      {props.children}
    </div>
  );
}

function SidebarFooter(props: SlotProps) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      class={cn("flex flex-col gap-2 p-2", props.class)}
    >
      {props.children}
    </div>
  );
}

function SidebarContent(props: SlotProps) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      class={cn(
        "no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto [--radius:var(--radius-xl)] group-data-[collapsible=icon]:overflow-hidden",
        props.class
      )}
    >
      {props.children}
    </div>
  );
}

function SidebarGroup(props: SlotProps) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      class={cn("relative flex w-full min-w-0 flex-col p-2", props.class)}
    >
      {props.children}
    </div>
  );
}

function SidebarGroupLabel(props: SlotProps) {
  return (
    <div
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      class={cn(
        "flex h-8 shrink-0 items-center rounded-xl px-3 text-xs font-medium text-sidebar-foreground/70 transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        props.class
      )}
    >
      {props.children}
    </div>
  );
}

function SidebarGroupContent(props: SlotProps) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      class={cn("w-full text-sm", props.class)}
    >
      {props.children}
    </div>
  );
}

function SidebarMenu(props: SlotProps) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      class={cn("flex w-full min-w-0 flex-col gap-0.5", props.class)}
    >
      {props.children}
    </ul>
  );
}

function SidebarMenuItem(props: SlotProps) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      class={cn("group/menu-item relative", props.class)}
    >
      {props.children}
    </li>
  );
}

/** A router link in the menu. Collapsed to its icon, its `tooltip` names it. */
function SidebarMenuLink(props: {
  to: LinkProps["to"];
  active: boolean;
  tooltip: string;
  class?: string;
  children: JSX.Element;
}) {
  const sidebar = useContext(SidebarContext);
  return (
    <Tooltip placement="right">
      <TooltipTrigger
        as={Link}
        to={props.to}
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        data-active={props.active ? "" : undefined}
        aria-current={props.active ? "page" : undefined}
        class={cn(
          "peer/menu-button group/menu-button flex h-8 w-full items-center gap-2 overflow-hidden rounded-xl px-3 py-2 text-left text-sm whitespace-nowrap ring-sidebar-ring outline-hidden transition-[width,height,padding] duration-200 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 active:bg-sidebar-accent active:text-sidebar-accent-foreground has-[>svg:first-child]:pl-2.5 data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
          props.class
        )}
      >
        {props.children}
      </TooltipTrigger>
      <TooltipContent class={sidebar.open() ? "hidden" : undefined}>{props.tooltip}</TooltipContent>
    </Tooltip>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
  SidebarProvider,
  SidebarTrigger,
};
