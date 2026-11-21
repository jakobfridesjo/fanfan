import * as z from "zod/mini";

const AppEnvSchema = z.looseObject({
  MODE: z.string(),
  DEV: z.boolean(),
  PROD: z.boolean(),
  BASE_URL: z.string(),
  VITE_APP_VERSION: z.string().check(z.minLength(1)),
  VITE_BUILD_TIME: z._default(z.string().check(z.minLength(1)), "unknown"),
});

const appEnv = AppEnvSchema.parse(import.meta.env);

/** The version in package.json, which Tauri also stamps on the bundle. */
export const appVersion = appEnv.VITE_APP_VERSION;

/** ISO timestamp of the build, or "unknown". */
export const buildTime = appEnv.VITE_BUILD_TIME;
