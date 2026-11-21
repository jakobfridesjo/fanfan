import { createAtom } from "@/shared/lib/atom.ts";
import { themeAtom } from "@/shared/config/preferences.ts";

const darkScheme = globalThis.matchMedia("(prefers-color-scheme: dark)");

/** The theme in effect: the chosen one, or the system's when it is `auto`. */
function themeMode(): "light" | "dark" {
  const theme = themeAtom.get();
  if (theme !== "auto") return theme;
  return darkScheme.matches ? "dark" : "light";
}

export const themeModeAtom = createAtom(themeMode());

/** Keeps `themeModeAtom` and the `dark` class on `<html>` in step with the theme. */
export function syncThemeClass() {
  const apply = () => {
    themeModeAtom.set(themeMode());
    document.documentElement.classList.toggle("dark", themeModeAtom.get() === "dark");
  };
  apply();
  themeAtom.subscribe(apply);
  darkScheme.addEventListener("change", apply);
}
