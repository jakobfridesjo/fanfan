import * as z from "zod/mini";
import { NonEmptyTrimmedStringSchema } from "@/shared/lib/field-schemas.ts";
import { schemaFormOptions } from "@/shared/lib/form.ts";
import { currentMessages } from "@/shared/i18n/messages.ts";

const HAN = /\p{Script=Han}/u;

export const KnownWordsFormSchema = z.object({
  text: NonEmptyTrimmedStringSchema.check(
    z.refine((text) => HAN.test(text), {
      error: () => currentMessages().knownWords.needsChinese,
    })
  ),
});

export type KnownWordsFormData = z.input<typeof KnownWordsFormSchema>;

export const EMPTY_KNOWN_WORDS_FORM: KnownWordsFormData = { text: "" };

export const knownWordsFormOptions = schemaFormOptions(
  KnownWordsFormSchema,
  EMPTY_KNOWN_WORDS_FORM
);
