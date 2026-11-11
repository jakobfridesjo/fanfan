/// <reference types="vite/client" />
/// <reference types="@vitest/browser-playwright" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_APP_VERSION: string;
  readonly VITE_BUILD_TIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
