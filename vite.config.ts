/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import path from "path";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig(({ mode }) => {
  // Tests pin their own env; a developer's `.env.local` must not reach them.
  const envDir = mode === "test" ? false : process.cwd();
  const env = loadEnv(mode, envDir, "");

  const buildTime = env.VITE_BUILD_TIME || new Date().toISOString();

  const plugins = [
    tanstackRouter({
      routesDirectory: "./src/app/routes",
      generatedRouteTree: "./src/app/routeTree.gen.ts",
      autoCodeSplitting: true,
    }),
    react({ compiler: true }),
    tailwindcss(),
    // The dev server only feeds the Tauri window; its URL is useless in a browser.
    {
      name: "hide-dev-server-urls",
      configureServer: (server) => {
        server.printUrls = () => {};
      },
    } satisfies Plugin,
  ];

  // Browser tests share one iframe per page (`isolate: false`); a file that calls
  // `vi.mock` would leak its mocks into the next, so it is named `*.isolated.test.tsx`.
  const browserTest = () => ({
    setupFiles: ["./src/app/testing/browser.ts"],
    testTimeout: 15_000,
    expect: { poll: { timeout: 5_000 } },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" as const, viewport: { width: 1440, height: 900 } }],
      screenshotDirectory: "test-results/screenshots",
    },
  });

  return {
    // Keeps Rust compiler output visible under `tauri dev`.
    clearScreen: false,
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
      "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildTime),
    },
    plugins,
    // Found late by the browser dep scan otherwise; the re-optimization reloads every test page.
    optimizeDeps: { include: ["react-dom/client"] },
    envDir,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    build: {
      target: "baseline-widely-available",
      sourcemap: mode === "debug",
      reportCompressedSize: false,
      // Inlined assets become data: URIs, which the CSP (src-tauri/tauri.build.conf.json) does not allow.
      assetsInlineLimit: 0,
    },
    test: {
      attachmentsDir: "test-results",
      mockReset: true,
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
      projects: [
        {
          extends: true,
          test: {
            name: "node",
            environment: "node",
            include: ["src/**/*.test.ts"],
            exclude: ["src/**/*.browser.test.ts"],
          },
        },
        {
          extends: true,
          test: {
            ...browserTest(),
            name: "browser",
            setupFiles: [
              "./src/app/testing/browser.ts",
              "./src/app/testing/browser-shared-page.ts",
            ],
            include: ["src/**/*.test.tsx", "src/**/*.browser.test.ts"],
            exclude: ["src/**/*.isolated.test.tsx"],
            isolate: false,
          },
        },
        {
          extends: true,
          test: {
            ...browserTest(),
            name: "browser-isolated",
            include: ["src/**/*.isolated.test.tsx"],
          },
        },
      ],
      coverage: {
        provider: "v8",
        reporter: ["text", "text-summary", "json-summary", "lcov"],
        reportOnFailure: true,
        // Without an explicit include, only files imported by tests are counted.
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/app/routeTree.gen.ts",
          "src/shared/ui/shadcn/**",
          "src/app/main.tsx",
          "src/shared/test/**",
          "src/app/testing/**",
          "**/*.d.ts",
        ],
        thresholds: {
          lines: 80,
          statements: 80,
          functions: 80,
          branches: 70,
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      watch: { ignored: ["**/src-tauri/**"] },
      fs: {
        allow: [path.resolve(import.meta.dirname)],
      },
    },
  };
});
