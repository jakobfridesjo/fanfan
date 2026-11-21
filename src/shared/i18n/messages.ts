import { languageAtom, type Language } from "@/shared/config/preferences.ts";
import { en, type Messages } from "@/shared/i18n/messages-en.ts";
import { sv } from "@/shared/i18n/messages-sv.ts";
import { zh } from "@/shared/i18n/messages-zh.ts";

const MESSAGES: Record<Language, Messages> = { en, sv, zh };

/** Each language's name in itself, so it can be found whatever the UI shows. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  sv: "Svenska",
  zh: "中文（简体）",
};

const followingLanguage = Object.defineProperties(
  {},
  Object.fromEntries(
    Object.keys(en).map((section) => [
      section,
      { enumerable: true, get: () => MESSAGES[languageAtom()][section as keyof Messages] },
    ])
  )
) as Messages;

/**
 * The UI text in the chosen language. Each section is read through the language signal, so
 * `m.common.back` in JSX follows a change of language; never destructure it.
 */
export function useMessages(): Messages {
  return followingLanguage;
}

/** The UI text in the chosen language, for code outside a component (schema errors). */
export function currentMessages(): Messages {
  return MESSAGES[languageAtom.get()];
}
