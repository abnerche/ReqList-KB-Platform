#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;

use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 在应用启动时建立数据库连接，并托管为全局状态（P0：单连接 + Mutex）
            let conn = db::connect(app.handle()).expect("初始化数据库失败");
            app.manage(Mutex::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_requirements,
            commands::create_requirement,
            commands::update_requirement,
            commands::delete_requirement,
            commands::list_knowledge,
            commands::create_knowledge,
            commands::update_knowledge,
            commands::delete_knowledge,
            commands::export_markdown,
            commands::export_word,
            commands::export_backup,
            commands::import_file,
            commands::save_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
