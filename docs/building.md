# Building

All tasks are mise tasks, run from the repo root. `mise tasks` lists them.

## System packages

The Rust side needs the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), plus `cmake` and a C++ compiler for the speech model (it compiles SentencePiece and libopus).

On x86_64 Linux, mise installs the [mold](https://github.com/rui314/mold) linker and sets `CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS` so that Rust builds started through mise (`mise exec`, the tasks or an activated shell) link with it. A plain `cargo` started outside mise uses the system linker. Android and macOS builds keep their own linkers.

**Fedora**

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel gcc-c++ cmake
```

**Ubuntu or Debian** (also under WSL)

```bash
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libgtk-3-dev build-essential pkg-config curl wget file cmake
```

**Fedora Atomic Desktop**

The host lacks the GTK libraries and `libstdc++.so`. Install the Fedora packages in the `fedora-toolbox-45` toolbox and run every Rust build there: `mise desktop`, `mise test`, `mise test:rust` and any `cargo`.

## Desktop

```bash
mise desktop        # run with hot reload
mise desktop:build  # installers in src-tauri/target/release/bundle/ (.deb and .rpm on Linux)
```

## Android

```bash
mise android:build    # signed arm64 APK
mise android:install  # install it on the adb-connected phone
```

- `android:build` first installs the NDK (`android:sdk`) and creates the release key in `~/.android` (`android:keystore`), outside the repo.
- Pair a phone over Wi-Fi with `adb pair`.
- Android-only crates (the fs plugin, and `percent-encoding` for `content://` URIs) are under `cfg(target_os = "android")` in `src-tauri/Cargo.toml`.
- `MainActivity.kt` is hand-edited: Rust calls its `keepScreenOn` over JNI (`src-tauri/src/screen_awake.rs`) to keep the screen on in the reader. Keep it if Tauri regenerates `gen/android`.

## macOS

```bash
mise desktop:build:mac  # .app and .dmg, on a Mac only
```

- Needs the Xcode Command Line Tools and `cmake`.
- `src-tauri/tauri.macos.conf.json` signs ad-hoc.
- To sign for distribution, set `APPLE_SIGNING_IDENTITY` and the notarization variables.
