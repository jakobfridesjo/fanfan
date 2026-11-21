import type { LinkProps } from "@tanstack/solid-router";
import { ChartColumn, GraduationCap, Library, ListChecks, Settings, type IconNode } from "lucide";
import type { Messages } from "@/shared/i18n/messages-en.ts";

export type NavLabel = Exclude<keyof Messages["nav"], "toggleSidebar">;

export interface NavItem {
  label: NavLabel;
  /** Where the entry navigates. Also its active-state check, matched by the router. */
  to: NonNullable<LinkProps["to"]>;
  icon: IconNode;
  fuzzy?: boolean;
}

export const studyNavItems: NavItem[] = [
  { label: "library", to: "/library", icon: Library, fuzzy: true },
  { label: "review", to: "/review", icon: GraduationCap },
  { label: "knownWords", to: "/known-words", icon: ListChecks },
  { label: "statistics", to: "/statistics", icon: ChartColumn },
];

export const settingsNavItem: NavItem = {
  label: "settings",
  to: "/settings",
  icon: Settings,
};
