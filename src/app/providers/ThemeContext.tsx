import { ReactNode, useEffect, useMemo, useState } from "react";
import { ThemeSettingSchema, type ThemeSetting } from "@/shared/config/theme-storage.ts";
import { persistedString } from "@/shared/lib/persisted-value.ts";
import { ThemeContext, type ThemeMode } from "@/app/providers/theme-context.ts";

const persistedTheme = persistedString<ThemeSetting>({
  key: "themePreference",
  schema: ThemeSettingSchema,
  fallback: "auto",
});

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [themeSetting, setThemeSettingState] = useState<ThemeSetting>(() => persistedTheme.load());

  const [systemPreference, setSystemPreference] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  const themeMode: ThemeMode = themeSetting === "auto" ? systemPreference : themeSetting;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    if (themeMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    persistedTheme.save(themeSetting);
  }, [themeMode, themeSetting]);

  const value = useMemo(
    () => ({ themeMode, themeSetting, setThemeSetting: setThemeSettingState }),
    [themeMode, themeSetting]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
