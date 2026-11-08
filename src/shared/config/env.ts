import * as z from "zod/mini";

const AppEnvSchema = z.looseObject({
  MODE: z.string(),
  DEV: z.boolean(),
  PROD: z.boolean(),
  BASE_URL: z.string(),
  VITE_APP_VERSION: z.string().check(z.minLength(1)),
  VITE_BUILD_TIME: z._default(z.string().check(z.minLength(1)), "unknown"),
  VITE_HEADER_TEXT: z._default(z.string(), ""),
  VITE_HEADER_COLOR: z._default(
    z.string().check(z.regex(/^(#[\da-f]{3}|#[\da-f]{6})?$/i, "Expected a hex color like #e11d48")),
    ""
  ),
});

const appEnv = AppEnvSchema.parse(import.meta.env);

/** Banner text shown in the page header; empty hides the banner. */
export const headerText = appEnv.VITE_HEADER_TEXT.trim();

/** Hex background color of the header banner; empty uses the warning color. */
export const headerColor = appEnv.VITE_HEADER_COLOR;

/** The version in package.json, which Tauri also stamps on the bundle. */
export const appVersion = appEnv.VITE_APP_VERSION;

/** ISO timestamp of the build, or "unknown". */
export const buildTime = appEnv.VITE_BUILD_TIME;
