//! The bundled CC-CEDICT as an ordinary file. On Android it is an APK asset
//! that `std::fs` cannot open, so each app version copies it once into its
//! data folder.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::AppHandle;

#[cfg(not(target_os = "android"))]
pub const DICTIONARY: &str = "cedict.txt.gz";
/// Android's asset packaging unpacks a `.gz` asset and drops the suffix.
#[cfg(target_os = "android")]
pub const DICTIONARY: &str = "cedict.txt";

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

    let data_dir = app.path().app_data_dir().map_err(io::Error::other)?;
    let root = data_dir.join("dictionary");
    let dir = root.join(app.package_info().version.to_string());
    let extracted = dir.join(".extracted");
    if extracted.is_file() {
        return Ok(dir);
    }

    // Copies for earlier versions.
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
    let asset = app
        .path()
        .resolve(format!("resources/{DICTIONARY}"), BaseDirectory::Resource)
        .map_err(io::Error::other)?;
    fs::create_dir_all(&dir)?;
    let mut options = OpenOptions::new();
    options.read(true);
    io::copy(
        &mut app.fs().open(asset, options)?,
        &mut File::create(dir.join(DICTIONARY))?,
    )?;
    let _ = fs::remove_file(asset_cache.join(DICTIONARY));
    File::create(extracted)?;
    Ok(dir)
}
