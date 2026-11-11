import * as z from "zod/mini";
import { NonEmptyTrimmedStringSchema } from "@/shared/lib/field-schemas.ts";
import { schemaFormOptions, useAppForm } from "@/shared/lib/form.ts";

const NameFormSchema = z.object({ name: NonEmptyTrimmedStringSchema });

export function useNameForm(initialName: string, onSubmit: (name: string) => void) {
  return useAppForm({
    ...schemaFormOptions(NameFormSchema, { name: initialName }),
    onSubmit: ({ validatorOutputs }) => onSubmit(validatorOutputs[0].name),
  });
}
