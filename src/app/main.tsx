import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import * as z from "zod/mini";
import { createAppRouter } from "@/app/router.tsx";
import { createQueryClient } from "@/shared/api/query-client.ts";
import {
  backgroundAtom,
  languageAtom,
  type Background,
  type Language,
} from "@/shared/config/preferences.ts";
import "@/app/styles/globals.css";

const ZOD_LOCALES: Record<Language, () => z.core.$ZodConfig> = {
  en: z.locales.en,
  sv: z.locales.sv,
  zh: z.locales.zhCN,
};

const applyLanguage = (language: Language) => {
  z.config(ZOD_LOCALES[language]());
  document.documentElement.lang = language;
};
applyLanguage(languageAtom.get());
languageAtom.subscribe(applyLanguage);

/** The background picks the theme's accent hue too, so the whole document carries it. */
const applyBackground = (background: Background) => {
  document.documentElement.dataset.background = background;
};
applyBackground(backgroundAtom.get());
backgroundAtom.subscribe(applyBackground);

window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

const router = createAppRouter({ queryClient: createQueryClient() });

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}
