import { useSelector } from "@tanstack/react-store";
import {
  backgroundAtom,
  languageAtom,
  scriptAtom,
  type Background,
  type Language,
  type Script,
} from "@/shared/config/preferences.ts";

/** The preferences apply as they change: no form, nothing to save. */
export function useSettingsManager() {
  return {
    language: useSelector(languageAtom),
    setLanguage: (language: Language) => languageAtom.set(language),
    script: useSelector(scriptAtom),
    setScript: (script: Script) => scriptAtom.set(script),
    background: useSelector(backgroundAtom),
    setBackground: (background: Background) => backgroundAtom.set(background),
  };
}
