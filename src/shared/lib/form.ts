import {
  createErrorVisibility,
  createFormHook,
  getFormHookHelpers,
  type StandardSchemaV1,
} from "@tanstack/react-form";
import { TextField } from "@/shared/ui/FormFields.tsx";

const { fieldComponent } = getFormHookHelpers();

const { useAppForm, appFormOptions } = createFormHook({
  fieldComponents: {
    TextField: fieldComponent.strict(TextField, "field"),
  },
  formComponents: {},
  defaultFormOptions: {
    // A field's errors show once it has been blurred, or after a submit attempt.
    errorVisibility: createErrorVisibility(
      ({ fieldState, state }) => fieldState.meta.isBlurred || state.submissionAttempts > 0
    ),
  },
});

type SchemaValidators<TInput, TOutput> = readonly [
  {
    run: StandardSchemaV1<TInput, TOutput>;
    triggers: Array<"change" | "blur">;
    runOnMount: true;
  },
];

/**
 * Options for a form whose values are the schema's input. It validates on
 * mount, change and blur, so `canSubmit` reflects the whole schema; submit
 * reads the parsed values from `validatorOutputs[0]`.
 */
export function schemaFormOptions<TInput, TOutput>(
  schema: StandardSchemaV1<TInput, TOutput>,
  defaultValues: NoInfer<TInput>
) {
  return appFormOptions.strictSchema<
    StandardSchemaV1<TInput, TOutput>,
    SchemaValidators<TInput, TOutput>,
    unknown
  >(schema, {
    defaultValues,
    validators: [{ run: schema, triggers: ["change", "blur"], runOnMount: true }],
  });
}

export { useAppForm };
