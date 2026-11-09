import { createAtom } from "@tanstack/react-store";
import { themeAtom } from "@/shared/config/preferences.ts";

const darkScheme = globalThis.matchMedia("(prefers-color-scheme: dark)");
const systemPrefersDarkAtom = createAtom(darkScheme.matches);
darkScheme.addEventListener("change", (event) => systemPrefersDarkAtom.set(event.matches));

/** The theme in effect: the chosen one, or the system's when it is `auto`. */
export const themeModeAtom = createAtom((): "light" | "dark" => {
  const theme = themeAtom.get();
  if (theme !== "auto") return theme;
  return systemPrefersDarkAtom.get() ? "dark" : "light";
});

/** Keeps the `dark` class on `<html>` in step with the theme; returns the unsubscribe. */
export function syncThemeClass() {
  const apply = (mode: "light" | "dark") => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  };
  apply(themeModeAtom.get());
  const subscription = themeModeAtom.subscribe(apply);
  return () => subscription.unsubscribe();
}
