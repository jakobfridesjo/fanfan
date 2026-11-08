import type { ComponentProps, ReactNode } from "react";
import type { FieldWithValue } from "@tanstack/react-form";
import { Input } from "@/shared/ui/shadcn/input.tsx";
import { Textarea } from "@/shared/ui/shadcn/textarea.tsx";
import { Checkbox } from "@/shared/ui/shadcn/checkbox.tsx";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/shared/ui/shadcn/field.tsx";

interface LabelledFieldProps<TValue> {
  field: FieldWithValue<TValue>;
  id: string;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
}

interface FieldShellProps extends Omit<LabelledFieldProps<unknown>, "field"> {
  errors: { message: string }[];
  children: ReactNode;
}

function FieldShell({ errors, id, label, description, required, children }: FieldShellProps) {
  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor={id}>
        {label}
        {required && (
          <>
            {" "}
            <span className="text-destructive">*</span>
          </>
        )}
      </FieldLabel>
      <FieldContent>
        {children}
        {description && <FieldDescription>{description}</FieldDescription>}
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  );
}

type TextFieldProps = LabelledFieldProps<string> &
  Omit<ComponentProps<typeof Input>, "id" | "value" | "onChange" | "onBlur" | "required">;

export function TextField({ field, id, label, description, required, ...props }: TextFieldProps) {
  return (
    <FieldShell
      errors={field.errors}
      id={id}
      label={label}
      description={description}
      required={required}
    >
      <Input
        {...props}
        id={id}
        value={field.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={field.errors.length > 0}
        required={required}
      />
    </FieldShell>
  );
}

type TextareaFieldProps = LabelledFieldProps<string> &
  Omit<ComponentProps<typeof Textarea>, "id" | "value" | "onChange" | "onBlur" | "required">;

export function TextareaField({
  field,
  id,
  label,
  description,
  required,
  ...props
}: TextareaFieldProps) {
  return (
    <FieldShell
      errors={field.errors}
      id={id}
      label={label}
      description={description}
      required={required}
    >
      <Textarea
        {...props}
        id={id}
        value={field.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={field.errors.length > 0}
        required={required}
      />
    </FieldShell>
  );
}

interface CheckboxFieldProps {
  field: FieldWithValue<boolean>;
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

export function CheckboxField({ field, id, label, disabled }: CheckboxFieldProps) {
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={field.value}
        onCheckedChange={(checked) => field.handleChange(checked)}
        disabled={disabled}
      />
      <FieldLabel htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}
