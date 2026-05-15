mod commands;
mod winget;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::search,
            commands::list_installed,
            commands::list_upgradable,
            commands::install,
            commands::uninstall,
            commands::upgrade,
            commands::upgrade_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
