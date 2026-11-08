import { useSelector } from "@tanstack/react-store";
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

/** The UI text in the chosen language; re-renders when the language changes. */
export function useMessages(): Messages {
  return MESSAGES[useSelector(languageAtom)];
}

/** The UI text in the chosen language, for code outside a render (schema errors). */
export function currentMessages(): Messages {
  return MESSAGES[languageAtom.get()];
}
