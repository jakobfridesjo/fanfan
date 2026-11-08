/// <reference types="vite/client" />
/// <reference types="@vitest/browser-playwright" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_APP_VERSION: string;
  readonly VITE_BUILD_TIME?: string;
  readonly VITE_HEADER_TEXT?: string;
  readonly VITE_HEADER_COLOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
