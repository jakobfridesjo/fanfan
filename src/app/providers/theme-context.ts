import { createContext, useContext } from "react";
import type { ThemeSetting } from "@/shared/config/theme-storage.ts";

export type ThemeMode = "light" | "dark";

interface ThemeContextType {
  themeMode: ThemeMode;
  themeSetting: ThemeSetting;
  setThemeSetting: (setting: ThemeSetting) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemePreference must be used within ThemePreferenceProvider");
  }
  return context;
}
