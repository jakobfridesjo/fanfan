import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, Show } from "solid-js";
import type { FormField } from "@/shared/lib/form.ts";
import { ariaBoolean } from "@/shared/lib/aria.ts";
import { Input } from "@/shared/ui/shadcn/input.tsx";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/shared/ui/shadcn/field.tsx";

type TextFieldProps = {
  field: FormField<string>;
  id: string;
  label: JSX.Element;
  /** For a field the dialog or page title already names: the label is left to screen readers. */
  hideLabel?: boolean;
  description?: JSX.Element;
  required?: boolean;
} & Omit<ComponentProps<typeof Input>, "id" | "value" | "onInput" | "onBlur" | "required">;

export function TextField(props: TextFieldProps) {
  const rest = omit(props, "field", "id", "label", "hideLabel", "description", "required");
  const invalid = () => props.field.errors.length > 0;
  // The typed text lives in the input; the form's value follows it.
  const initial = props.field.value;

  return (
    <Field invalid={invalid()}>
      <FieldLabel for={props.id} class={props.hideLabel ? "sr-only" : undefined}>
        {props.label}
        <Show when={props.required}>
          {" "}
          <span class="text-destructive">*</span>
        </Show>
      </FieldLabel>
      <FieldContent>
        <Input
          {...rest}
          id={props.id}
          ref={(element) => (element.value = initial)}
          onInput={(event) => props.field.handleChange(event.currentTarget.value)}
          onBlur={() => props.field.handleBlur()}
          aria-invalid={ariaBoolean(invalid())}
          required={props.required}
        />
        <Show when={props.description}>
          <FieldDescription>{props.description}</FieldDescription>
        </Show>
        <FieldError errors={props.field.errors} />
      </FieldContent>
    </Field>
  );
}
