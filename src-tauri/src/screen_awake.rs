//! Keeps the screen from dimming or locking while a book is open.

#[cfg(desktop)]
use std::sync::{Mutex, PoisonError};

pub struct ScreenAwake {
    /// The app's identifier: its name to the desktop's screensaver, and the
    /// package of its Android activity.
    identifier: String,
    /// Held while the screen is kept on; dropping it lets the screen dim again.
    #[cfg(desktop)]
    inhibitor: Mutex<Option<keepawake::KeepAwake>>,
}

impl ScreenAwake {
    pub fn new(identifier: String) -> Self {
        Self {
            identifier,
            #[cfg(desktop)]
            inhibitor: Mutex::new(None),
        }
    }

    #[cfg(desktop)]
    pub fn set(&self, awake: bool) -> Result<(), String> {
        let mut inhibitor = self
            .inhibitor
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        if !awake {
            *inhibitor = None;
        } else if inhibitor.is_none() {
            *inhibitor = Some(
                keepawake::Builder::default()
                    .display(true)
                    .reason("Reading a book")
                    .app_name("FanFan")
                    .app_reverse_domain(&self.identifier)
                    .create()
                    .map_err(|error| format!("Could not keep the screen on: {error}"))?,
            );
        }
        Ok(())
    }

    /// Sets `FLAG_KEEP_SCREEN_ON` through `MainActivity.keepScreenOn`, which
    /// Android clears by itself whenever the app leaves the screen.
    #[cfg(target_os = "android")]
    pub fn set(&self, awake: bool) -> Result<(), String> {
        use jni::JavaVM;
        use jni::objects::{JClass, JObject, JValue};

        let android = ndk_context::android_context();
        // SAFETY: tao registers the app's JavaVM and Application context before the app starts.
        let vm = unsafe { JavaVM::from_raw(android.vm().cast()) }.map_err(|e| e.to_string())?;
        let context = unsafe { JObject::from_raw(android.context().cast()) };
        let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;

        let mut call = || -> jni::errors::Result<()> {
            // A native thread finds only system classes; the app's own load through its class loader.
            let loader = env
                .call_method(&context, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])?
                .l()?;
            let name = env.new_string(format!("{}.MainActivity", self.identifier))?;
            let activity = env
                .call_method(
                    &loader,
                    "loadClass",
                    "(Ljava/lang/String;)Ljava/lang/Class;",
                    &[JValue::Object(&name)],
                )?
                .l()?;
            env.call_static_method(
                JClass::from(activity),
                "keepScreenOn",
                "(Z)V",
                &[JValue::Bool(awake.into())],
            )?;
            Ok(())
        };
        let result = call();
        if result.is_err() {
            // A Java exception stays pending until cleared, and would break the next JNI call.
            let _ = env.exception_clear();
        }
        result.map_err(|error| format!("Could not keep the screen on: {error}"))
    }
}
