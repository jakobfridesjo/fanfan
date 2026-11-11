# 翻翻 FanFan

A Tauri 2 app for desktop and Android that teaches a Chinese book's vocabulary before and while you read it. Import a `.txt`, `.epub` or `.pdf`; its words come as a frequency-ranked swipe deck (right: known, left: learn), the reader colours each word by status, and learned words come back for review on an FSRS schedule.

The React frontend (`src/`) calls Tauri commands (`src-tauri/src/commands.rs`) over `vocab-core/`, a plain Rust crate that holds all logic: text extraction, jieba segmentation, CC-CEDICT, SQLite, FSRS, offline MOSS-TTS-Nano speech and offline opus-mt Chinese-to-English translation.

## Quick start

```bash
mise install  # tools
mise setup    # dependencies, CC-CEDICT, git hooks, test browser
mise desktop  # run the app with hot reload
```

Building the Rust side needs the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) plus `cmake` and `gcc-c++` (the speech model compiles SentencePiece and libopus). On Fedora:

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel gcc-c++ cmake
```

On Ubuntu or Debian (also under WSL):

```bash
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libgtk-3-dev build-essential pkg-config curl wget file cmake
```

On a Fedora Atomic Desktop, install them in a toolbox and run the Rust tasks there.

## Build

```bash
mise desktop:build    # installers in src-tauri/target/release/bundle/
mise android:build    # signed arm64 APK (installs the NDK and creates a key in ~/.android)
mise android:install  # install it on the adb-connected phone
```

## Check and test

```bash
mise check  # lint, format, typecheck, knip, steiger
mise fix    # auto-fix lint and formatting
mise test   # Rust core, then frontend
```

## Licences

FanFan is licensed under either of [Apache License 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT), at your option. Unless you state otherwise, any contribution you submit for inclusion is dual-licensed the same way, without additional terms.

CC-CEDICT (CC BY-SA 4.0) is downloaded by `mise setup` and bundled with the app. MOSS-TTS-Nano (Apache-2.0) and Helsinki-NLP's opus-mt-zh-en (CC BY 4.0, in Xenova's int8 ONNX export) are not bundled: the app downloads each from Hugging Face the first time it is needed, or from Settings. The HSK 3.0 word levels (from complete-hsk-vocabulary, MIT), the TBCL word levels and the TOCFL word levels are vendored in `src-tauri/vocab-core/data/levels.tsv`. TBCL levels: 臺灣華語文能力基準（TBCL）三等七級詞語表, 國家教育研究院 (National Academy for Educational Research), https://coct.naer.edu.tw/page.jsp?ID=41, used under NAER's open-data declaration (https://www.naer.edu.tw/PageDoc?fid=324), read 2026-11-09. The app adds simplified forms from CC-CEDICT and leaves the levels unchanged. TOCFL levels (華語八千詞): vocabulary data from LinZi - https://www.linzi.app/data/ (`tocfl-words.csv`, generated 2026-11-02), CC BY-SA 4.0; the app keeps only each word's two forms and its band, stored as 1 to 7 for Novice 1 and 2 and Levels 1 to 5, and `levels.tsv` is under CC BY-SA 4.0 too. Cangjie codes come from Unicode's Unihan database 18.0.0 (`kCangjie`, Unicode License v3), vendored in `src-tauri/vocab-core/data/cangjie.tsv`. Every Rust and npm dependency is under a permissive licence or MPL-2.0.

## Docs

- [Dependency upgrades](docs/dependency-upgrades.md)
- [Agent skills](docs/skill-managing.md)
