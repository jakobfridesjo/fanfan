# AGENTS.md

- A Tauri 2 app for desktop and Android: import a Chinese .txt/.epub/.pdf, get its words as a frequency-ranked swipe deck, read it chapter by chapter with each word coloured by status, review learned words with FSRS
- Standard Tauri layout: the React frontend (Vite, `src/`) is the top-level project and `src-tauri/` is the Rust project inside it
- `src-tauri` is the Rust side: `src/commands.rs` is a thin layer of Tauri commands over `vocab-core/`, which holds all logic (text extraction into chapters, jieba segmentation shared by decks and the reader, CC-CEDICT, SQLite store, FSRS, MOSS-TTS-Nano speech) and never depends on Tauri
- The frontend talks to Rust only through `invoke`, wrapped in `src/shared/api/commands.ts`. Its types mirror the serde types by hand: change both together, and keep `serializes_decks_and_queues_with_the_frontend_field_names` in `vocab-core/src/service.rs` in step
- Run everything as mise tasks from the repo root: `mise <task>`. On this Silverblue host all Rust (`mise desktop`, `mise test:rust`, any `cargo`) builds only inside the `fedora-toolbox-45` toolbox: the speech model compiles SentencePiece (C++, `cmake` and `gcc-c++`)
- CC-CEDICT (CC BY-SA 4.0) is downloaded by `mise dictionary:fetch` into `src-tauri/resources/` and bundled; MOSS-TTS-Nano (Apache-2.0, weights for the pinned `moss-tts-nano-rust-candle` commit) and its reference voice likewise by `mise voice:fetch` into `src-tauri/resources/voice/`; bump the git `rev` and the weights together. Both are gitignored. The webview's `speechSynthesis` has no Chinese voice on Linux (WebKitGTK uses Flite)
- Android: `mise android:build` installs the NDK (`android:sdk`), creates the release key in `~/.android` (`android:keystore`), and builds a signed arm64 APK; `mise android:install` puts it on the adb-connected phone. Android-only crates (fs plugin for `content://` URIs, vendored OpenSSL) are under `cfg(target_os = "android")` in `src-tauri/Cargo.toml`
- `speaks_simplified_and_traditional_words` needs the real voice, so it is `#[ignore]`d: run it with `cargo test -p vocab-core -- --ignored`
- Clear code beats comments
- Edit only `AGENTS.md`; each `CLAUDE.md` is a symlink to it
- Verify with `mise check` (lint, format, typecheck) and `mise test` (Rust core, then frontend)

## Frontend structure

- FSD v2.1, layers `app → pages → features → entities → shared`: import only from lower layers, never sideways between slices; no barrels, import the concrete file via `@/` with its extension (`@/pages/deck/model/use-deck-manager.ts`); `shared/` has no slices. `mise fsd`
- Filenames: kebab-case modules, PascalCase components; `app/routes/` follows TanStack Router (`_app/` is the pathless sidebar shell). Never edit `routeTree.gen.ts`
- A page slice's state and mutations live in `model/use-<x>-manager.ts`; `ui/<X>Manager.tsx` only renders. `pages/deck` is the reference slice
- Forms are TanStack Form via `shared/lib/form.ts`: `useAppForm` with `schemaFormOptions(schema, empty)`, submit from `validatorOutputs[0]`, `loadForm` to swap values. Render standard fields with `field.TextField`/`TextareaField`/`CheckboxField` (`shared/ui/FormFields.tsx`). Errors show inline after blur or submit, never as toasts
- UI text lives in `shared/i18n/messages-{en,sv,zh}.ts`: English defines the `Messages` type, the others must match it. Read it with `useMessages()` (or `currentMessages()` outside a render, e.g. zod `error: () => ...`); never hard-code user-facing strings. Numbers and dates follow the language through `appLocale()`
- Settings (language, script, background) are persisted atoms in `shared/config/preferences.ts`, read with `useSelector`. The script is a command argument and part of the deck and review query keys: Rust converts each card's `displayWord` and `example`, while `word` stays the stored key
- Chinese text gets `lang="zh"`, so the webview picks a Chinese font
- Use LTS Node.js and Node.js types
- UI components: see `src/shared/ui/AGENTS.md`
- `knip.json` treats `src/shared/**` as entry points so the toolkit is not reported as unused; remove that entry once the app has grown into it

## Frontend: commands (Rust)

- The app runs only in Tauri: there is no HTTP backend. Every call to Rust goes through `commands` in `shared/api/commands.ts`; never call `invoke` elsewhere. Rust rejects with its error message as a string: show it with `commandErrorMessage(error, fallback)`
- Query options and keys live in `shared/api/queries.ts`. A word's status changes every deck, coverage figure and the review queue, so word mutations call `invalidateStudyData`
- Slow commands report progress through a Tauri `Channel` (see `importDocument`)
- `zod/mini` only: wrap, don't chain (`z.optional(x)`, `z.extend`, `x.check(...)`)

## Frontend tests

- `*.test.ts` runs in Node; `*.test.tsx` and `*.browser.test.ts` in Chromium (Vitest Browser Mode, `vitest-browser-react`, no jsdom) on one shared page: reset global stores in `app/testing/browser-shared-page.ts`. Chromium: `mise test:web:browsers` (`--with-deps` on fresh Linux)
- Rust is mocked at the IPC boundary with `mockCommands` (`shared/test/tauri.ts`, Tauri's `mockIPC`); push `Channel` messages with `sendToChannel`. Never `vi.mock` `commands.ts`. Assert on what was sent with `callsTo`
- Build command results with `shared/test/fixtures.ts` (`makeDocument`, `makeCard`, `makeDeck`, ...), overriding only the fields the test or UI reads. A handler that keeps state (a `Map` of statuses) beats scripting each refetch
- Prefer the DOM, `renderPageInRouter`/`renderRoute` and props over `vi.mock()`. A browser test file that mocks must be `*.isolated.test.tsx`, and a mock targets a concrete module
