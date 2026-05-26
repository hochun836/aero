mod adblock;
mod commands;
mod tab_manager;

use std::sync::{Arc, Mutex};
use adblock::AdBlockEngine;
use tab_manager::TabManager;

pub struct AppState {
    pub tab_manager: Mutex<TabManager>,
    pub adblock: Arc<Mutex<AdBlockEngine>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(AppState {
            tab_manager: Mutex::new(TabManager::new()),
            adblock: Arc::new(Mutex::new(AdBlockEngine::new())),
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_tab,
            commands::close_tab,
            commands::switch_tab,
            commands::navigate_tab,
            commands::go_back,
            commands::go_forward,
            commands::reload_tab,
            commands::update_content_area,
            commands::report_tab_title,
            commands::set_adblock_enabled,
            commands::get_adblock_enabled,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
