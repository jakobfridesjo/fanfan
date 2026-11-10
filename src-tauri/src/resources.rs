//! The bundled CC-CEDICT, voice and translator as ordinary files. On Android they are APK
//! assets that `std::fs` cannot open, so each app version copies them once
//! into its data folder.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::AppHandle;

#[cfg(not(target_os = "android"))]
pub const DICTIONARY: &str = "cedict.txt.gz";
/// Android's asset packaging unpacks a `.gz` asset and drops the suffix.
#[cfg(target_os = "android")]
pub const DICTIONARY: &str = "cedict.txt";
pub const VOICE: &str = "voice";
pub const TRANSLATOR: &str = "translator";

pub struct Resources {
    app: AppHandle,
    dir: OnceLock<Result<PathBuf, String>>,
}

impl Resources {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            dir: OnceLock::new(),
        }
    }

    /// Later callers wait for the first, so none reads a half-copied file.
    pub fn dir(&self) -> Result<&Path, String> {
        self.dir
            .get_or_init(|| {
                locate(&self.app)
                    .map_err(|error| format!("Could not find the bundled resources: {error}"))
            })
            .as_deref()
            .map_err(Clone::clone)
    }
}

#[cfg(not(target_os = "android"))]
fn locate(app: &AppHandle) -> tauri::Result<PathBuf> {
    use tauri::Manager;
    use tauri::path::BaseDirectory;

    app.path().resolve("resources", BaseDirectory::Resource)
}

#[cfg(target_os = "android")]
fn locate(app: &AppHandle) -> std::io::Result<PathBuf> {
    use std::fs::{self, File};
    use std::io;

    use tauri::Manager;
    use tauri::path::BaseDirectory;
    use tauri_plugin_fs::{FsExt, OpenOptions};

    let root = app
        .path()
        .app_data_dir()
        .map_err(io::Error::other)?
        .join("resources");
    let dir = root.join(app.package_info().version.to_string());
    let extracted = dir.join(".extracted");
    if extracted.is_file() {
        return Ok(dir);
    }

    // Copies for earlier versions: the voice alone is hundreds of megabytes.
    for entry in fs::read_dir(&root).into_iter().flatten().flatten() {
        if entry.path() != dir {
            fs::remove_dir_all(entry.path())?;
        }
    }

    // The fs plugin opens an asset by copying it here first.
    let asset_cache = app
        .path()
        .app_cache_dir()
        .map_err(io::Error::other)?
        .join("_assets/resources");
    let files = std::iter::once(DICTIONARY.to_owned())
        .chain(
            vocab_core::speech::FILES
                .iter()
                .map(|name| format!("{VOICE}/{name}")),
        )
        .chain(
            vocab_core::translation::FILES
                .iter()
                .map(|name| format!("{TRANSLATOR}/{name}")),
        );
    for name in files {
        let asset = app
            .path()
            .resolve(format!("resources/{name}"), BaseDirectory::Resource)
            .map_err(io::Error::other)?;
        let target = dir.join(&name);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut options = OpenOptions::new();
        options.read(true);
        io::copy(
            &mut app.fs().open(asset, options)?,
            &mut File::create(&target)?,
        )?;
        let _ = fs::remove_file(asset_cache.join(&name));
    }
    File::create(extracted)?;
    Ok(dir)
}
