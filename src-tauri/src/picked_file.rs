//! A file the user picked, as a path vocab-core can open. On Android the
//! picker returns a content:// URI, so its bytes are copied to the cache first.

use std::path::{Path, PathBuf};

use tauri::AppHandle;

pub struct PickedFile {
    path: PathBuf,
    /// A copy this app made, deleted once the import is done.
    copied: bool,
}

impl PickedFile {
    #[cfg(not(target_os = "android"))]
    pub fn open(_app: &AppHandle, picked: &str) -> std::io::Result<Self> {
        Ok(Self {
            path: picked.into(),
            copied: false,
        })
    }

    #[cfg(target_os = "android")]
    pub fn open(app: &AppHandle, picked: &str) -> std::io::Result<Self> {
        use std::fs::{self, File};
        use std::io;

        use tauri::Manager;
        use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

        if !picked.starts_with("content://") {
            return Ok(Self {
                path: picked.into(),
                copied: false,
            });
        }
        let dir = app
            .path()
            .app_cache_dir()
            .map_err(io::Error::other)?
            .join("import");
        fs::create_dir_all(&dir)?;
        let path = dir.join(file_name(picked));
        let mut options = OpenOptions::new();
        options.read(true);
        let uri: FilePath = picked.parse().expect("parsing a FilePath never fails");
        io::copy(&mut app.fs().open(uri, options)?, &mut File::create(&path)?)?;
        Ok(Self { path, copied: true })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for PickedFile {
    fn drop(&mut self) {
        if self.copied {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

/// The name the URI's last segment gives, which becomes a text file's title:
/// `…/document/primary%3ADownload%2F书.txt` is `书.txt`, but a provider that
/// shows only an id (`msf%3A1000`) gives `1000`.
#[cfg(target_os = "android")]
fn file_name(uri: &str) -> String {
    let segment = uri.rsplit('/').next().unwrap_or_default();
    let decoded = percent_encoding::percent_decode_str(segment).decode_utf8_lossy();
    decoded
        .rsplit(['/', ':'])
        .next()
        .filter(|name| !name.is_empty() && *name != "." && *name != "..")
        .unwrap_or("Untitled")
        .to_owned()
}
