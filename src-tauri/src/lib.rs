mod commands;
mod error;
mod logging;
mod winget;

use commands::AppState;
use tauri::{Manager, WindowEvent};

pub use winget::Package;

/// Parser entry point for the integration tests in `tests/`.
pub fn parse_packages_for_tests(output: &str) -> Vec<Package> {
    winget::parse_packages(output)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Held for the process lifetime so the background log writer keeps flushing.
    let _log_guard = logging::init();

    let state = AppState::default();
    let registry = state.registry.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(state)
        .on_window_event(move |_window, event| {
            // winget spawns the real installer as a child process. Closing the
            // window without killing the tree leaves installs running invisibly.
            if let WindowEvent::CloseRequested { .. } = event {
                tracing::info!("window closing; cancelling in-flight operations");
                registry.cancel_all();
            }
        })
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(debug_assertions)]
                window.open_devtools();
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_winget,
            commands::search,
            commands::list_installed,
            commands::list_upgradable,
            commands::show,
            commands::install,
            commands::uninstall,
            commands::upgrade,
            commands::upgrade_all,
            commands::cancel,
            commands::export_list,
            commands::import_list,
            commands::relaunch_elevated,
            commands::open_log_dir,
            commands::open_url,
            commands::show_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Wingman");
}
