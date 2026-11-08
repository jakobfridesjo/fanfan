mod commands;
mod picked_file;
mod resources;

use tauri::Manager;
use vocab_core::store::Store;

use crate::commands::AppState;
use crate::resources::Resources;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(tauri_plugin_fs::init());
    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let database = data_dir.join("vocab.sqlite3");
            // The writer migrates the database before the reader opens it.
            let writer = Store::open(&database)?;
            let reader = Store::open_reader(&database)?;
            let speech_cache_dir = app.path().app_cache_dir()?.join("speech");
            app.manage(AppState::new(
                writer,
                reader,
                Resources::new(app.handle().clone()),
                speech_cache_dir,
            ));

            // Warm the dictionary up so the first import or deck does not wait for it;
            // on Android this first copies the bundled files out of the APK.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(error) = handle.state::<AppState>().language() {
                    log::error!("{error:?}");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_documents,
            commands::import_document,
            commands::delete_document,
            commands::list_folders,
            commands::create_folder,
            commands::rename_folder,
            commands::move_document,
            commands::get_cover,
            commands::get_deck,
            commands::list_sections,
            commands::get_section,
            commands::set_reading_position,
            commands::get_word_statuses,
            commands::get_word_card,
            commands::mark_words_known,
            commands::set_word_status,
            commands::restore_word,
            commands::get_review_queue,
            commands::review_word,
            commands::undo_review,
            commands::import_known_words,
            commands::list_words,
            commands::get_word_counts,
            commands::get_statistics,
            commands::speak,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
