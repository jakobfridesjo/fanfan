import * as z from "zod/mini";
import { currentMessages } from "@/shared/i18n/messages.ts";

/** Read when validation runs, so it follows the UI language. */
const required = () => currentMessages().common.required;

export const NonEmptyTrimmedStringSchema = z
  .string()
  .check(z.trim(), z.minLength(1, { error: required }));

// The text helpers widen their output to the contract's input, which is optional
// for fields with a default and nullable for optional ones; `z.pipe` needs it to match.

/** A required text input: trimmed and non-empty, then the contract's own checks. */
export function requiredText<TContract extends z.ZodMiniType<unknown, string | undefined>>(
  contract: TContract,
  message?: string
) {
  return z.pipe(
    z.pipe(
      z.string().check(z.trim(), z.minLength(1, { error: () => message ?? required() })),
      z.transform((value): string | undefined => value)
    ),
    contract
  );
}

/** An optional text input: trimmed, sent as `null` when blank, then the contract's own checks. */
export function optionalText<TContract extends z.ZodMiniType<unknown, string | null | undefined>>(
  contract: TContract
) {
  return z.pipe(
    z.pipe(
      z.string().check(z.trim()),
      z.transform((value): string | null | undefined => value || null)
    ),
    contract
  );
}

export const NullishTrimmedStringSchema = z.nullish(z.string().check(z.trim()));

export const EmailSchema = z.pipe(
  z.string().check(z.trim()),
  z.email("Must be a valid email").check(z.maxLength(255))
);

export const HttpUrlSchema = z.url({ protocol: /^https?$/, error: "Must be a valid URL" });

/**
 * A boolean persisted as a bare `"true"`/`"false"` string, as `String(value)`
 * writes it.
 */
export const BooleanStringSchema = z.pipe(
  z.enum(["true", "false"]),
  z.transform((value) => value === "true")
);
