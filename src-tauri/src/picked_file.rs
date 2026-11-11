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
        let path = dir.join(display_name(picked).unwrap_or_else(|| file_name(picked)));
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

/// The name the file picker showed, which becomes a text or PDF file's title.
/// The URI alone does not tell it: Downloads and Recent give a MediaStore id
/// (`…/document/msf%3A1000`), so the provider is asked for its display name.
#[cfg(target_os = "android")]
fn display_name(uri: &str) -> Option<String> {
    use jni::JavaVM;
    use jni::objects::{JObject, JString, JValue};

    let android = ndk_context::android_context();
    // SAFETY: tao registers the app's JavaVM and Application context before the app starts.
    let vm = unsafe { JavaVM::from_raw(android.vm().cast()) }.ok()?;
    let context = unsafe { JObject::from_raw(android.context().cast()) };
    let mut env = vm.attach_current_thread().ok()?;

    let mut query = || -> jni::errors::Result<Option<String>> {
        let resolver = env
            .call_method(
                &context,
                "getContentResolver",
                "()Landroid/content/ContentResolver;",
                &[],
            )?
            .l()?;
        let uri = env.new_string(uri)?;
        let uri = env
            .call_static_method(
                "android/net/Uri",
                "parse",
                "(Ljava/lang/String;)Landroid/net/Uri;",
                &[JValue::Object(&uri)],
            )?
            .l()?;
        // OpenableColumns.DISPLAY_NAME
        let column = env.new_string("_display_name")?;
        let projection = env.new_object_array(1, "java/lang/String", &column)?;
        let null = JObject::null();
        let cursor = env
            .call_method(
                &resolver,
                "query",
                "(Landroid/net/Uri;[Ljava/lang/String;Ljava/lang/String;[Ljava/lang/String;Ljava/lang/String;)Landroid/database/Cursor;",
                &[
                    JValue::Object(&uri),
                    JValue::Object(&projection),
                    JValue::Object(&null),
                    JValue::Object(&null),
                    JValue::Object(&null),
                ],
            )?
            .l()?;
        if cursor.is_null() {
            return Ok(None);
        }
        let mut name = None;
        if env.call_method(&cursor, "moveToFirst", "()Z", &[])?.z()? {
            let value = env
                .call_method(
                    &cursor,
                    "getString",
                    "(I)Ljava/lang/String;",
                    &[JValue::Int(0)],
                )?
                .l()?;
            if !value.is_null() {
                name = Some(String::from(env.get_string(&JString::from(value))?));
            }
        }
        env.call_method(&cursor, "close", "()V", &[])?;
        Ok(name)
    };
    let name = query();
    if name.is_err() {
        // A Java exception stays pending until cleared, and would break the next JNI call.
        let _ = env.exception_clear();
    }
    name.ok()
        .flatten()
        .filter(|name| !name.is_empty() && !name.contains('/') && name != "." && name != "..")
}

/// The name the URI's last segment gives, when the provider has no display name:
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
