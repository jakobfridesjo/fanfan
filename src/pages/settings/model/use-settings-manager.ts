import { useSelector } from "@tanstack/react-store";
import {
  backgroundAtom,
  languageAtom,
  scriptAtom,
  shownExamsAtom,
  shownNotationsAtom,
  speakerAtom,
  themeAtom,
  type Background,
  type Exam,
  type Language,
  type Notation,
  type Script,
  type Speaker,
  type Theme,
} from "@/shared/config/preferences.ts";

/** The preferences apply as they change: no form, nothing to save. */
export function useSettingsManager() {
  return {
    language: useSelector(languageAtom),
    setLanguage: (language: Language) => languageAtom.set(language),
    script: useSelector(scriptAtom),
    setScript: (script: Script) => scriptAtom.set(script),
    speaker: useSelector(speakerAtom),
    setSpeaker: (speaker: Speaker) => speakerAtom.set(speaker),
    shownNotations: useSelector(shownNotationsAtom),
    setShownNotations: (notations: Notation[]) => shownNotationsAtom.set(notations),
    theme: useSelector(themeAtom),
    setTheme: (theme: Theme) => themeAtom.set(theme),
    background: useSelector(backgroundAtom),
    setBackground: (background: Background) => backgroundAtom.set(background),
    shownExams: useSelector(shownExamsAtom),
    setShownExams: (exams: Exam[]) => shownExamsAtom.set(exams),
  };
}
