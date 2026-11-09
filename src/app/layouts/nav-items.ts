import type { LinkProps } from "@tanstack/react-router";
import {
  ChartColumn,
  GraduationCap,
  Library,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Messages } from "@/shared/i18n/messages-en.ts";

export type NavLabel = keyof Messages["nav"];

export interface NavItem {
  label: NavLabel;
  /** Where the entry navigates. Also its active-state check, matched by the router. */
  link: LinkProps;
  icon: LucideIcon;
  fuzzy?: boolean;
}

export const studyNavItems: NavItem[] = [
  { label: "library", link: { to: "/library" }, icon: Library, fuzzy: true },
  { label: "review", link: { to: "/review" }, icon: GraduationCap },
  { label: "knownWords", link: { to: "/known-words" }, icon: ListChecks },
  { label: "statistics", link: { to: "/statistics" }, icon: ChartColumn },
];

export const settingsNavItem: NavItem = {
  label: "settings",
  link: { to: "/settings" },
  icon: Settings,
};
