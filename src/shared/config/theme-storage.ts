import * as z from "zod/mini";

export const ThemeSettingSchema = z.enum(["light", "dark", "auto"]);

export type ThemeSetting = z.infer<typeof ThemeSettingSchema>;
