use rusqlite::Connection;
use std::path::PathBuf;
use tauri::Manager;

/// 返回 app.db 的绝对路径：%APPDATA%/<identifier>/app.db
/// 不写入程序目录，避免无写权限（符合 P0 风险注意第 2 条）
pub fn db_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("无法获取应用数据目录，请检查系统权限");
    std::fs::create_dir_all(&dir).ok();
    dir.join("app.db")
}

/// 打开数据库连接并初始化表结构（幂等，使用 IF NOT EXISTS）
pub fn connect(app: &tauri::AppHandle) -> rusqlite::Result<Connection> {
    let path = db_path(app);
    let conn = Connection::open(path)?;
    init_schema(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS requirements (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT,
            priority TEXT,
            status TEXT,
            tags TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS knowledge (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT,
            category TEXT,
            tags TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE
        );
        CREATE TABLE IF NOT EXISTS links (
            req_id INTEGER,
            know_id INTEGER
        );",
    )
}
