import { languageAtom, type Language } from "@/shared/config/preferences.ts";

const LOCALES: Record<Language, string> = { en: "en-US", sv: "sv-SE", zh: "zh-CN" };

/** The locale numbers and dates are formatted in: the UI language's. */
export function appLocale(): string {
  return LOCALES[languageAtom.get()];
}
