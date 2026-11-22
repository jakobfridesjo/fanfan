# Architecture

## Layout

| Path                         | What it is                                                  |
| ---------------------------- | ----------------------------------------------------------- |
| `src/`                       | Solid frontend (Vite), the top-level project                |
| `src-tauri/vocab-core/`      | All logic, with no Tauri dependency                         |
| `src-tauri/src/commands.rs`  | Tauri commands: a thin layer over `vocab-core`              |
| `src/shared/api/commands.ts` | The frontend's only way into Rust; there is no HTTP backend |

## The command contract

**Types are mirrored by hand.** The TypeScript types in `commands.ts` copy the serde types. When you change one side, change the other and the test `serializes_decks_and_queues_with_the_frontend_field_names` in `vocab-core/src/service.rs`.

**Errors** come back as the Rust error message, a plain string. **Progress** for slow commands goes through a Tauri `Channel` (see `importDocument`).

**Settings that change what Rust returns** are command arguments and part of the query key:

| Setting          | Command                  | Note                                                                          |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------- |
| Script           | decks, review, bookmarks | Converts `displayWord`, `example` and bookmark excerpts; `word` stays the key |
| `speaker`        | `speak`                  | Each voice's audio is cached separately                                       |
| `readerNotation` | `get_section`            | Pinyin or zhuyin above each character                                         |

Other settings only change what the UI shows.

## Data

| Data                    | File                                    | Updated by              |
| ----------------------- | --------------------------------------- | ----------------------- |
| CC-CEDICT               | `src-tauri/resources/` (gitignored)     | `mise dictionary:fetch` |
| HSK, TBCL, TOCFL levels | `src-tauri/vocab-core/data/levels.tsv`  | `mise data:update`      |
| Cangjie codes           | `src-tauri/vocab-core/data/cangjie.tsv` | `mise data:update`      |

CC-CEDICT is bundled with the app; the `data/` files are compiled into `vocab-core`. Sources and licences: [licences.md](licences.md).

The learner's own data lives in one SQLite database (`vocab-core/src/store/`). **Settings → Export** writes it as JSON (`Store::backup` in `store/backup.rs`): word statuses with their FSRS cards, the review history, and each book's reading position and bookmarks, but not the books' text. **Settings → Import** merges one back (`Store::restore_backup`): each word keeps its newer change, missing reviews are added, and a book already in the library, matched by its file's hash, gets its bookmarks, its folder and, if newer, its reading position. Nothing is deleted, so importing twice changes nothing. Bump `BACKUP_VERSION` when its shape changes; an import refuses a newer version.

## Models

| Model         | Used for    | Code                            |
| ------------- | ----------- | ------------------------------- |
| MOSS-TTS-Nano | Speech      | `vocab-core/src/speech.rs`      |
| opus-mt-zh-en | Translation | `vocab-core/src/translation.rs` |

- Both run in fp16 on the CPU; see `vocab-core/src/onnx.rs`. tract's wgpu runtime ran them about six times slower: it has no kernel for the attention masks, the GELU's power or the sampler's top-k, so every layer went to the CPU and back.
- The voice keeps its hidden states and attention caches in f16 between runs (`onnx::keep_half_precision`). Left in f32, converting the caches takes two fifths of a decoding step.
- The voice's prefill is read once (`onnx::parse`) and pinned to each padded prompt length it meets. Pin input facts before typing; `TypedModel::set_symbols` on the typed prefill overflows in tract 0.23.
- A speaker's prompt up to the text is prefilled once and its attention cache kept; each text then runs through the decode step a row at a time, which masks attention for a single row only.
- Models are downloaded on first use, never bundled. The file list in `vocab-core/src/models.rs` is the single source of URLs, sizes and SHA-256 checksums.
- **Bumping MOSS-TTS-Nano:** update its files, its `folder` name and `MODEL_ID` in `speech.rs` together.
- In the frontend, call `ensureModel` (`src/shared/api/model-downloads.ts`) before anything that needs a model. It opens the download dialog when the model is missing.
- The webview's `speechSynthesis` is no fallback: on Linux it has no Chinese voice (WebKitGTK uses Flite).
