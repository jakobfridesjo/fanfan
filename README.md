# 翻翻 FanFan

A Tauri 2 app for desktop and Android that teaches a Chinese book's vocabulary before and while you read it. Import a `.txt`, `.epub` or `.pdf`; its words come as a frequency-ranked swipe deck (right: known, left: learn), the reader colours each word by status, and learned words come back for review on an FSRS schedule.

The React frontend (`src/`) calls Tauri commands (`src-tauri/src/commands.rs`) over `vocab-core/`, a plain Rust crate that holds all logic: text extraction, jieba segmentation, CC-CEDICT, SQLite, FSRS and offline MOSS-TTS-Nano speech.

## Quick start

```bash
mise install  # tools
mise setup    # dependencies, CC-CEDICT, voice model, git hooks, test browser
mise desktop  # run the app with hot reload
```

Building the Rust side needs the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) plus `cmake` and `gcc-c++` (the speech model compiles SentencePiece). On Fedora:

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

CC-CEDICT (CC BY-SA 4.0) and MOSS-TTS-Nano (Apache-2.0) are downloaded by `mise setup` and bundled with the app. The HSK 3.0 word levels (from complete-hsk-vocabulary, MIT) and the TOCFL 2023 word levels (SC-TOP's published list, no open licence) are vendored in `src-tauri/vocab-core/data/levels.tsv`. Every Rust and npm dependency is under a permissive licence or MPL-2.0.

## Docs

- [Dependency upgrades](docs/dependency-upgrades.md)
- [Agent skills](docs/skill-managing.md)
