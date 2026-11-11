import type { ComponentProps, ReactNode } from "react";
import type { FieldWithValue } from "@tanstack/react-form";
import { Input } from "@/shared/ui/shadcn/input.tsx";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/shared/ui/shadcn/field.tsx";

type TextFieldProps = {
  field: FieldWithValue<string>;
  id: string;
  label: ReactNode;
  /** For a field the dialog or page title already names: the label is left to screen readers. */
  hideLabel?: boolean;
  description?: ReactNode;
  required?: boolean;
} & Omit<ComponentProps<typeof Input>, "id" | "value" | "onChange" | "onBlur" | "required">;

export function TextField({
  field,
  id,
  label,
  hideLabel = false,
  description,
  required,
  ...props
}: TextFieldProps) {
  const invalid = field.errors.length > 0;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
        {required && (
          <>
            {" "}
            <span className="text-destructive">*</span>
          </>
        )}
      </FieldLabel>
      <FieldContent>
        <Input
          {...props}
          id={id}
          value={field.value}
          onChange={(event) => field.handleChange(event.target.value)}
          onBlur={field.handleBlur}
          aria-invalid={invalid}
          required={required}
        />
        {description && <FieldDescription>{description}</FieldDescription>}
        <FieldError errors={field.errors} />
      </FieldContent>
    </Field>
  );
}
