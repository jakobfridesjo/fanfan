import { createMemo, createSignal } from "solid-js";
import type * as z from "zod/mini";

/** One field of a form: its value, the errors to show, and what its input calls. */
export interface FormField<T> {
  readonly value: T;
  /** Empty until the field has been blurred or a submit was tried. */
  readonly errors: { message: string }[];
  handleChange: (value: T) => void;
  handleBlur: () => void;
}

/**
 * A form whose values are the schema's input. It validates as the values change; a field's
 * errors show once it has been blurred, or after a submit attempt. `onSubmit` gets the parsed values.
 */
export function useSchemaForm<TInput extends Record<string, unknown>, TOutput>(
  schema: z.ZodMiniType<TOutput, TInput>,
  defaultValues: TInput,
  onSubmit: (values: TOutput) => void
) {
  const [state, setState] = createSignal({ values: defaultValues });
  const values = () => state().values;
  const [blurred, setBlurred] = createSignal<ReadonlySet<keyof TInput>>(new Set());
  const [submissionAttempts, setSubmissionAttempts] = createSignal(0);
  const parsed = createMemo(() => schema.safeParse(values()));

  return {
    field<K extends keyof TInput & string>(name: K): FormField<TInput[K]> {
      return {
        get value() {
          return values()[name];
        },
        get errors() {
          const result = parsed();
          if (result.success || !(blurred().has(name) || submissionAttempts() > 0)) return [];
          return result.error.issues
            .filter((issue) => issue.path[0] === name)
            .map((issue) => ({ message: issue.message }));
        },
        handleChange: (value) =>
          setState((current) => ({ values: { ...current.values, [name]: value } })),
        handleBlur: () => setBlurred((names) => new Set(names).add(name)),
      };
    },
    get canSubmit() {
      return parsed().success;
    },
    handleSubmit() {
      setSubmissionAttempts((count) => count + 1);
      const result = schema.safeParse(values());
      if (result.success) onSubmit(result.data);
    },
  };
}
