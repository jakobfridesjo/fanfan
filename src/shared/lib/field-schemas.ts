import * as z from "zod/mini";
import { currentMessages } from "@/shared/i18n/messages.ts";

/** Read when validation runs, so it follows the UI language. */
const required = () => currentMessages().common.required;

export const NonEmptyTrimmedStringSchema = z
  .string()
  .check(z.trim(), z.minLength(1, { error: required }));

/**
 * A boolean persisted as a bare `"true"`/`"false"` string, as `String(value)`
 * writes it.
 */
export const BooleanStringSchema = z.pipe(
  z.enum(["true", "false"]),
  z.transform((value) => value === "true")
);
