import * as z from "zod/mini";
import { NonEmptyTrimmedStringSchema } from "@/shared/lib/field-schemas.ts";
import { schemaFormOptions, useAppForm } from "@/shared/lib/form.ts";

const FolderNameFormSchema = z.object({ name: NonEmptyTrimmedStringSchema });

export function useFolderNameForm(initialName: string, onSubmit: (name: string) => void) {
  return useAppForm({
    ...schemaFormOptions(FolderNameFormSchema, { name: initialName }),
    onSubmit: ({ validatorOutputs }) => onSubmit(validatorOutputs[0].name),
  });
}
