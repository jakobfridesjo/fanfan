import * as z from "zod/mini";
import { NonEmptyTrimmedStringSchema } from "@/shared/lib/field-schemas.ts";
import { useSchemaForm } from "@/shared/lib/form.ts";

const NameFormSchema = z.object({ name: NonEmptyTrimmedStringSchema });

export function useNameForm(initialName: string, onSubmit: (name: string) => void) {
  return useSchemaForm(NameFormSchema, { name: initialName }, (values) => onSubmit(values.name));
}
