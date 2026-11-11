# Architecture

## Layout

| Path                         | What it is                                                  |
| ---------------------------- | ----------------------------------------------------------- |
| `src/`                       | React frontend (Vite), the top-level project                |
| `src-tauri/vocab-core/`      | All logic, with no Tauri dependency                         |
| `src-tauri/src/commands.rs`  | Tauri commands: a thin layer over `vocab-core`              |
| `src/shared/api/commands.ts` | The frontend's only way into Rust; there is no HTTP backend |

## The command contract

**Types are mirrored by hand.** The TypeScript types in `commands.ts` copy the serde types. When you change one side, change the other and the test `serializes_decks_and_queues_with_the_frontend_field_names` in `vocab-core/src/service.rs`.

**Errors** come back as the Rust error message, a plain string. **Progress** for slow commands goes through a Tauri `Channel` (see `importDocument`).

**Settings that change what Rust returns** are command arguments and part of the query key:

| Setting          | Command       | Note                                                       |
| ---------------- | ------------- | ---------------------------------------------------------- |
| Script           | decks, review | Converts `displayWord` and `example`; `word` stays the key |
| `speaker`        | `speak`       | Each voice's audio is cached separately                    |
| `readerNotation` | `get_section` | Pinyin or zhuyin above each character                      |

Other settings only change what the UI shows.

## Data

| Data                    | File                                    | Updated by              |
| ----------------------- | --------------------------------------- | ----------------------- |
| CC-CEDICT               | `src-tauri/resources/` (gitignored)     | `mise dictionary:fetch` |
| HSK, TBCL, TOCFL levels | `src-tauri/vocab-core/data/levels.tsv`  | `mise data:update`      |
| Cangjie codes           | `src-tauri/vocab-core/data/cangjie.tsv` | `mise data:update`      |

CC-CEDICT is bundled with the app; the `data/` files are compiled into `vocab-core`. Sources and licences: [licences.md](licences.md).

## Models

| Model         | Used for    | Code                            |
| ------------- | ----------- | ------------------------------- |
| MOSS-TTS-Nano | Speech      | `vocab-core/src/speech.rs`      |
| opus-mt-zh-en | Translation | `vocab-core/src/translation.rs` |

- Models are downloaded on first use, never bundled. The file list in `vocab-core/src/models.rs` is the single source of URLs, sizes and SHA-256 checksums.
- **Bumping MOSS-TTS-Nano:** update its files, its `folder` name and `MODEL_ID` in `speech.rs` together.
- In the frontend, call `ensureModel` (`src/shared/api/model-downloads.ts`) before anything that needs a model. It opens the download dialog when the model is missing.
- The webview's `speechSynthesis` is no fallback: on Linux it has no Chinese voice (WebKitGTK uses Flite).
