import {
  backgroundAtom,
  languageAtom,
  readerNotationAtom,
  scriptAtom,
  shownExamsAtom,
  shownNotationsAtom,
  speakerAtom,
  themeAtom,
  type Background,
  type Exam,
  type Language,
  type Notation,
  type ReaderNotation,
  type Script,
  type Speaker,
  type Theme,
} from "@/shared/config/preferences.ts";

/** The preferences apply as they change: no form, nothing to save. */
export function useSettingsManager() {
  return {
    get language() {
      return languageAtom();
    },
    setLanguage: (language: Language) => languageAtom.set(language),
    get script() {
      return scriptAtom();
    },
    setScript: (script: Script) => scriptAtom.set(script),
    get speaker() {
      return speakerAtom();
    },
    setSpeaker: (speaker: Speaker) => speakerAtom.set(speaker),
    get shownNotations() {
      return shownNotationsAtom();
    },
    setShownNotations: (notations: Notation[]) => shownNotationsAtom.set(notations),
    get readerNotation() {
      return readerNotationAtom();
    },
    setReaderNotation: (notation: ReaderNotation) => readerNotationAtom.set(notation),
    get theme() {
      return themeAtom();
    },
    setTheme: (theme: Theme) => themeAtom.set(theme),
    get background() {
      return backgroundAtom();
    },
    setBackground: (background: Background) => backgroundAtom.set(background),
    get shownExams() {
      return shownExamsAtom();
    },
    setShownExams: (exams: Exam[]) => shownExamsAtom.set(exams),
  };
}
