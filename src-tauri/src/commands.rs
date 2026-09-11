use base64::Engine;
use docx_rs::{BreakType, Docx, Paragraph, Pic, Run};
use image::GenericImageView;
use regex::Regex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager, State};

/// 全局数据库状态：单连接 + Mutex（P0 够用，后续如需并发可换连接池）
type DbState = Mutex<Connection>;

// ---------------- 数据模型（与 DDL 对齐） ----------------

#[derive(Serialize)]
pub struct Requirement {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub r#type: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub tags: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct Knowledge {
    pub id: i64,
    pub title: String,
    pub body: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize, Default)]
pub struct RequirementInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
}

#[derive(Deserialize, Default)]
pub struct KnowledgeInput {
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
}

// ---------------- 工具 ----------------

fn now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn app_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("无法获取应用数据目录，请检查系统权限")
}

fn exports_dir(app: &AppHandle, export_dir: Option<String>) -> PathBuf {
    let p = match export_dir {
        Some(dir) => PathBuf::from(dir),
        None => app_data_dir(app).join("exports"),
    };
    std::fs::create_dir_all(&p).ok();
    p
}

// ---------------- 内部查询 ----------------

fn fetch_requirement(conn: &Connection, id: i64) -> Result<Requirement, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, type, priority, status, tags, created_at, updated_at \
             FROM requirements WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;
    stmt.query_row([id], |row| {
        Ok(Requirement {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            r#type: row.get(3)?,
            priority: row.get(4)?,
            status: row.get(5)?,
            tags: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })
    .map_err(|e| e.to_string())
}

fn fetch_knowledge(conn: &Connection, id: i64) -> Result<Knowledge, String> {
    let mut stmt = conn
        .prepare("SELECT id, title, body, category, tags, created_at FROM knowledge WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    stmt.query_row([id], |row| {
        Ok(Knowledge {
            id: row.get(0)?,
            title: row.get(1)?,
            body: row.get(2)?,
            category: row.get(3)?,
            tags: row.get(4)?,
            created_at: row.get(5)?,
        })
    })
    .map_err(|e| e.to_string())
}

fn fetch_requirements(conn: &Connection) -> Result<Vec<Requirement>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, type, priority, status, tags, created_at, updated_at \
             FROM requirements ORDER BY id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Requirement {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                r#type: row.get(3)?,
                priority: row.get(4)?,
                status: row.get(5)?,
                tags: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    collect(rows)
}

fn fetch_knowledge_all(conn: &Connection) -> Result<Vec<Knowledge>, String> {
    let mut stmt = conn
        .prepare("SELECT id, title, body, category, tags, created_at FROM knowledge ORDER BY id DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Knowledge {
                id: row.get(0)?,
                title: row.get(1)?,
                body: row.get(2)?,
                category: row.get(3)?,
                tags: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    collect(rows)
}

// ---------------- 搜索 / 分页 ----------------

#[derive(Serialize)]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Deserialize, Default)]
pub struct SearchRequirementInput {
    #[serde(default)]
    pub keyword: String,
    #[serde(default = "bool_true")]
    pub search_title: bool,
    #[serde(default = "bool_true")]
    pub search_description: bool,
    #[serde(default)]
    pub search_tags: bool,
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
}

#[derive(Deserialize, Default)]
pub struct SearchKnowledgeInput {
    #[serde(default)]
    pub keyword: String,
    #[serde(default = "bool_true")]
    pub search_title: bool,
    #[serde(default = "bool_true")]
    pub search_body: bool,
    #[serde(default)]
    pub search_category: bool,
    #[serde(default)]
    pub search_tags: bool,
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
}

fn bool_true() -> bool {
    true
}

fn default_page() -> i64 {
    1
}

fn default_page_size() -> i64 {
    15
}

fn search_requirements_sql(conn: &Connection, input: &SearchRequirementInput) -> Result<Paginated<Requirement>, String> {
    let kw = input.keyword.trim();
    let has_kw = !kw.is_empty();
    let like = format!("%{kw}%");
    let page = input.page.max(1);
    let page_size = input.page_size.clamp(1, 200);
    let offset = (page - 1) * page_size;

    let mut conditions: Vec<String> = Vec::new();
    if has_kw {
        let mut ors = Vec::new();
        if input.search_title {
            ors.push("title LIKE ?1".to_string());
        }
        if input.search_description {
            ors.push("description LIKE ?1".to_string());
        }
        if input.search_tags {
            ors.push("tags LIKE ?1".to_string());
        }
        if !ors.is_empty() {
            conditions.push(format!("({})", ors.join(" OR ")));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM requirements {where_clause}");
    let total: i64 = if has_kw {
        conn.query_row(&count_sql, [&like], |row| row.get(0))
    } else {
        conn.query_row(&count_sql, [], |row| row.get(0))
    }
    .map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT id, title, description, type, priority, status, tags, created_at, updated_at \
         FROM requirements {where_clause} ORDER BY id DESC LIMIT ?2 OFFSET ?3"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<rusqlite::types::Value> = if has_kw {
        vec![like.clone().into(), page_size.into(), offset.into()]
    } else {
        // SQL 仍使用 ?2 / ?3，无 ?1 时需要一个占位参数，避免 page_size 被绑到 ?2、offset 绑到 ?3 错位
        vec![rusqlite::types::Value::Null, page_size.into(), offset.into()]
    };
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            Ok(Requirement {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                r#type: row.get(3)?,
                priority: row.get(4)?,
                status: row.get(5)?,
                tags: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(Paginated {
        items: collect(rows)?,
        total,
        page,
        page_size,
    })
}

fn search_knowledge_sql(conn: &Connection, input: &SearchKnowledgeInput) -> Result<Paginated<Knowledge>, String> {
    let kw = input.keyword.trim();
    let has_kw = !kw.is_empty();
    let like = format!("%{kw}%");
    let page = input.page.max(1);
    let page_size = input.page_size.clamp(1, 200);
    let offset = (page - 1) * page_size;

    let mut conditions: Vec<String> = Vec::new();
    if has_kw {
        let mut ors = Vec::new();
        if input.search_title {
            ors.push("title LIKE ?1".to_string());
        }
        if input.search_body {
            ors.push("body LIKE ?1".to_string());
        }
        if input.search_category {
            ors.push("category LIKE ?1".to_string());
        }
        if input.search_tags {
            ors.push("tags LIKE ?1".to_string());
        }
        if !ors.is_empty() {
            conditions.push(format!("({})", ors.join(" OR ")));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM knowledge {where_clause}");
    let total: i64 = if has_kw {
        conn.query_row(&count_sql, [&like], |row| row.get(0))
    } else {
        conn.query_row(&count_sql, [], |row| row.get(0))
    }
    .map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT id, title, body, category, tags, created_at \
         FROM knowledge {where_clause} ORDER BY id DESC LIMIT ?2 OFFSET ?3"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params: Vec<rusqlite::types::Value> = if has_kw {
        vec![like.clone().into(), page_size.into(), offset.into()]
    } else {
        vec![rusqlite::types::Value::Null, page_size.into(), offset.into()]
    };
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            Ok(Knowledge {
                id: row.get(0)?,
                title: row.get(1)?,
                body: row.get(2)?,
                category: row.get(3)?,
                tags: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(Paginated {
        items: collect(rows)?,
        total,
        page,
        page_size,
    })
}

fn collect<'stmt, T, F>(rows: rusqlite::MappedRows<'stmt, F>) -> Result<Vec<T>, String>
where
    F: FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
{
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

// ---------------- 需求命令 ----------------

#[tauri::command]
pub fn list_requirements(
    input: Option<SearchRequirementInput>,
    db: State<DbState>,
) -> Result<Paginated<Requirement>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let input = input.unwrap_or_default();
    search_requirements_sql(&conn, &input)
}

#[tauri::command]
pub fn create_requirement(input: RequirementInput, db: State<DbState>) -> Result<Requirement, String> {
    let ts = now();
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO requirements (title, description, type, priority, status, tags, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        rusqlite::params![
            input.title, input.description, input.r#type, input.priority,
            input.status, input.tags, ts, ts
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    fetch_requirement(&conn, id)
}

#[tauri::command]
pub fn update_requirement(id: i64, input: RequirementInput, db: State<DbState>) -> Result<Requirement, String> {
    let ts = now();
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE requirements SET title=?1, description=?2, type=?3, priority=?4, status=?5, tags=?6, updated_at=?7 WHERE id=?8",
        rusqlite::params![
            input.title, input.description, input.r#type, input.priority,
            input.status, input.tags, ts, id
        ],
    )
    .map_err(|e| e.to_string())?;
    fetch_requirement(&conn, id)
}

#[tauri::command]
pub fn delete_requirement(id: i64, db: State<DbState>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM requirements WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- 知识命令 ----------------

#[tauri::command]
pub fn list_knowledge(
    input: Option<SearchKnowledgeInput>,
    db: State<DbState>,
) -> Result<Paginated<Knowledge>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let input = input.unwrap_or_default();
    search_knowledge_sql(&conn, &input)
}

#[tauri::command]
pub fn create_knowledge(input: KnowledgeInput, db: State<DbState>) -> Result<Knowledge, String> {
    let ts = now();
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO knowledge (title, body, category, tags, created_at) VALUES (?1,?2,?3,?4,?5)",
        rusqlite::params![input.title, input.body, input.category, input.tags, ts],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    fetch_knowledge(&conn, id)
}

#[tauri::command]
pub fn update_knowledge(id: i64, input: KnowledgeInput, db: State<DbState>) -> Result<Knowledge, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE knowledge SET title=?1, body=?2, category=?3, tags=?4 WHERE id=?5",
        rusqlite::params![input.title, input.body, input.category, input.tags, id],
    )
    .map_err(|e| e.to_string())?;
    fetch_knowledge(&conn, id)
}

#[tauri::command]
pub fn delete_knowledge(id: i64, db: State<DbState>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM knowledge WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- 图片保存 ----------------

#[tauri::command]
pub fn save_image(app: AppHandle, data: String) -> Result<String, String> {
    // 前端可能传完整的 data:image/png;base64,xxx 或仅 base64
    let b64 = if let Some((_, rest)) = data.split_once(',') {
        rest.trim()
    } else {
        data.trim()
    };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| e.to_string())?;

    let dir = app_data_dir(&app).join("images");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = format!("{}.png", uuid::Uuid::new_v4());
    let path = dir.join(&name);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(format!("images/{}", name))
}

// ---------------- 导出命令 ----------------

#[tauri::command]
pub fn export_markdown(
    app: AppHandle,
    scope: String,
    export_dir: Option<String>,
    db: State<DbState>,
) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut md = String::new();
    md.push_str("# 需求清单与知识库 · 导出\n\n");
    md.push_str(&format!("_生成时间：{}_  \n\n", now()));

    let include_req = scope == "all" || scope == "requirements";
    let include_know = scope == "all" || scope == "knowledge";

    if include_req {
        md.push_str("## 需求清单\n\n");
        for r in fetch_requirements(&conn)? {
            let t = r.r#type.clone().unwrap_or_default();
            let p = r.priority.clone().unwrap_or_default();
            let s = r.status.clone().unwrap_or_default();
            md.push_str(&format!("### {} （{} / {} / {}）\n\n", r.title, t, p, s));
            if let Some(d) = &r.description {
                md.push_str(d);
                md.push('\n');
            }
            md.push('\n');
        }
    }

    if include_know {
        md.push_str("## 知识库\n\n");
        for k in fetch_knowledge_all(&conn)? {
            md.push_str(&format!("### {}\n\n", k.title));
            if let Some(c) = &k.category {
                md.push_str(&format!("- 分类：{}\n", c));
            }
            if let Some(t) = &k.tags {
                md.push_str(&format!("- 标签：{}\n", t));
            }
            md.push('\n');
            if let Some(b) = &k.body {
                md.push_str(b);
                md.push_str("\n\n");
            }
        }
    }

    let fname = format!("export-{}.md", chrono::Local::now().format("%Y%m%d-%H%M%S"));
    let path = exports_dir(&app, export_dir).join(fname);
    std::fs::write(&path, md).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_word(
    app: AppHandle,
    scope: String,
    export_dir: Option<String>,
    db: State<DbState>,
) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let base = app_data_dir(&app);
    let mut docx = Docx::new();

    docx = docx.add_paragraph(
        Paragraph::new().add_run(Run::new().add_text("需求清单与知识库 · 导出").bold()),
    );

    let include_req = scope == "all" || scope == "requirements";
    let include_know = scope == "all" || scope == "knowledge";

    if include_req {
        docx = docx.add_paragraph(
            Paragraph::new().add_run(Run::new().add_text("需求清单").bold()),
        );
        for r in fetch_requirements(&conn)? {
            let heading = format!(
                "{}（{} / {} / {}）",
                r.title,
                r.r#type.as_deref().unwrap_or("-"),
                r.priority.as_deref().unwrap_or("-"),
                r.status.as_deref().unwrap_or("-")
            );
            docx = docx.add_paragraph(
                Paragraph::new().add_run(Run::new().add_text(&heading).bold()),
            );
            if let Some(desc) = &r.description {
                for para in markdown_to_docx_paragraphs(desc, &base) {
                    docx = docx.add_paragraph(para);
                }
            }
        }
    }

    if include_know {
        docx = docx.add_paragraph(
            Paragraph::new().add_run(Run::new().add_text("知识库").bold()),
        );
        for k in fetch_knowledge_all(&conn)? {
            docx = docx.add_paragraph(
                Paragraph::new().add_run(Run::new().add_text(&k.title).bold()),
            );
            if let Some(c) = &k.category {
                docx = docx.add_paragraph(
                    Paragraph::new().add_run(Run::new().add_text(format!("分类：{}", c))),
                );
            }
            if let Some(t) = &k.tags {
                docx = docx.add_paragraph(
                    Paragraph::new().add_run(Run::new().add_text(format!("标签：{}", t))),
                );
            }
            if let Some(body) = &k.body {
                for para in markdown_to_docx_paragraphs(body, &base) {
                    docx = docx.add_paragraph(para);
                }
            }
        }
    }

    let fname = format!("export-{}.docx", chrono::Local::now().format("%Y%m%d-%H%M%S"));
    let path = exports_dir(&app, export_dir).join(fname);
    let file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    docx.pack(file).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

// ---------------- Markdown -> docx 段落 ----------------

fn markdown_to_docx_paragraphs(md: &str, base: &PathBuf) -> Vec<Paragraph> {
    static IMG_RE: OnceLock<Regex> = OnceLock::new();
    let re = IMG_RE.get_or_init(|| Regex::new(r"!\[(.*?)\]\((.+?)\)").unwrap());
    let mut out = Vec::new();

    for block in md.split("\n\n") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        // 每个块一个段落；段落内部可以 inline 混合文本与图片
        let mut para = Paragraph::new();
        let mut last_end = 0usize;

        for caps in re.captures_iter(block) {
            let whole = caps.get(0).unwrap();
            let alt = caps.get(1).unwrap().as_str();
            let src = caps.get(2).unwrap().as_str().trim();

            // 图片前面的文本（可能含换行）
            if whole.start() > last_end {
                para = append_text_with_breaks(para, &block[last_end..whole.start()]);
            }

            // 尝试嵌入图片；失败则回退为占位文字
            if let Some(pic) = build_pic(src, base) {
                para = para.add_run(Run::new().add_image(pic));
            } else {
                para = para.add_run(Run::new().add_text(format!("[图片: {}]", alt)));
            }

            last_end = whole.end();
        }

        // 图片后面的剩余文本
        if last_end < block.len() {
            para = append_text_with_breaks(para, &block[last_end..]);
        }

        out.push(para);
    }

    out
}

fn append_text_with_breaks(mut para: Paragraph, text: &str) -> Paragraph {
    let lines: Vec<&str> = text.lines().collect();
    for (i, line) in lines.iter().enumerate() {
        para = para.add_run(Run::new().add_text(*line));
        if i + 1 < lines.len() {
            para = para.add_run(Run::new().add_break(BreakType::TextWrapping));
        }
    }
    para
}

fn build_pic(src: &str, base: &PathBuf) -> Option<Pic> {
    let path = resolve_image_path(src, base);
    let bytes = std::fs::read(&path).ok()?;
    let img = image::load_from_memory(&bytes).ok()?;
    let (w_px, h_px) = img.dimensions();
    let max_w = 600u32;
    let (w, h) = if w_px > max_w {
        let ratio = max_w as f32 / w_px as f32;
        (max_w, (h_px as f32 * ratio) as u32)
    } else {
        (w_px, h_px)
    };
    let w_emu = w * 9525;
    let h_emu = h * 9525;
    Some(Pic::new(&bytes).size(w_emu, h_emu))
}

fn resolve_image_path(src: &str, base: &PathBuf) -> PathBuf {
    let p = PathBuf::from(src);
    if p.is_absolute() {
        p
    } else {
        base.join(src)
    }
}

// ---------------- 备份导出（JSON，含图片）/ 导入 ----------------

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct BackupRequirement {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct BackupKnowledge {
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct BackupFile {
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub exported_at: Option<String>,
    #[serde(default)]
    pub requirements: Vec<BackupRequirement>,
    #[serde(default)]
    pub knowledge: Vec<BackupKnowledge>,
    /// 相对路径 -> base64 图片内容（保证换台机器也能还原图片）
    #[serde(default)]
    pub images: BTreeMap<String, String>,
}

#[derive(Serialize)]
pub struct ImportResult {
    pub format: String,
    pub requirements: usize,
    pub knowledge: usize,
    pub images: usize,
    pub skipped: usize,
    /// Markdown 里引用了、但文件本身没带图数据的图片数量
    pub missing_images: usize,
    pub titles: Vec<String>,
    pub dry_run: bool,
}

struct ParsedImport {
    format: String,
    requirements: Vec<BackupRequirement>,
    knowledge: Vec<BackupKnowledge>,
    images: BTreeMap<String, String>,
    missing_images: usize,
}

/// 导出 JSON 备份（含内嵌图片），可发给他人后由其导入
#[tauri::command]
pub fn export_backup(
    app: AppHandle,
    scope: String,
    export_dir: Option<String>,
    db: State<DbState>,
) -> Result<String, String> {
    let base = app_data_dir(&app);
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut reqs: Vec<BackupRequirement> = Vec::new();
    let mut knows: Vec<BackupKnowledge> = Vec::new();
    let mut images: BTreeMap<String, String> = BTreeMap::new();

    if scope == "all" || scope == "requirements" {
        for r in fetch_requirements(&conn)? {
            collect_image_refs(r.description.as_deref(), &mut images, &base);
            reqs.push(BackupRequirement {
                title: r.title,
                description: r.description,
                r#type: r.r#type,
                priority: r.priority,
                status: r.status,
                tags: r.tags,
                created_at: Some(r.created_at),
            });
        }
    }

    if scope == "all" || scope == "knowledge" {
        for k in fetch_knowledge_all(&conn)? {
            collect_image_refs(k.body.as_deref(), &mut images, &base);
            knows.push(BackupKnowledge {
                title: k.title,
                body: k.body,
                category: k.category,
                tags: k.tags,
                created_at: Some(k.created_at),
            });
        }
    }

    let backup = BackupFile {
        kind: "reqkb-backup".to_string(),
        version: 1,
        exported_at: Some(now()),
        requirements: reqs,
        knowledge: knows,
        images,
    };

    let json = serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())?;
    let fname = format!("backup-{}.json", chrono::Local::now().format("%Y%m%d-%H%M%S"));
    let path = exports_dir(&app, export_dir).join(fname);
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// 扫描 Markdown 中的本地图片引用，把文件内容以 base64 收集起来
fn collect_image_refs(
    text: Option<&str>,
    out: &mut BTreeMap<String, String>,
    base: &PathBuf,
) {
    let Some(text) = text else { return };
    let re = match Regex::new(r"!\[[^\]]*\]\(([^)]+)\)") {
        Ok(r) => r,
        Err(_) => return,
    };
    for caps in re.captures_iter(text) {
        let src = caps[1].trim().to_string();
        if src.starts_with("http://")
            || src.starts_with("https://")
            || src.starts_with("data:")
        {
            continue;
        }
        if out.contains_key(&src) {
            continue;
        }
        if let Ok(bytes) = std::fs::read(base.join(&src)) {
            let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
            out.insert(src, encoded);
        }
    }
}

/// 导入备份/标记文件。mode: "skip"（同名跳过，默认）或 "append"（全部追加）。
/// dry_run=true 时只解析统计，不写库。
#[tauri::command]
pub fn import_file(
    app: AppHandle,
    path: String,
    mode: Option<String>,
    dry_run: Option<bool>,
    db: State<DbState>,
) -> Result<ImportResult, String> {
    let dry = dry_run.unwrap_or(false);
    let skip_dup = mode.unwrap_or_else(|| "skip".to_string()) != "append";

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取文件失败：{}", e))?;

    let lower = path.to_lowercase();
    let trimmed = content.trim_start();
    let parsed: ParsedImport = if lower.ends_with(".json") || trimmed.starts_with('{') {
        parse_backup_json(&content)?
    } else {
        parse_markdown_doc(&content)
    };

    let conn = db.lock().map_err(|e| e.to_string())?;
    let base = app_data_dir(&app);

    let mut titles: Vec<String> = Vec::new();
    let (mut n_req, mut n_kno, mut n_skip) = (0usize, 0usize, 0usize);

    for r in &parsed.requirements {
        if skip_dup && title_exists_req(&conn, &r.title)? {
            n_skip += 1;
            continue;
        }
        if !dry {
            let ts = r.created_at.clone().unwrap_or_else(now);
            conn.execute(
                "INSERT INTO requirements (title, description, type, priority, status, tags, created_at, updated_at) \
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                rusqlite::params![
                    r.title,
                    r.description,
                    r.r#type,
                    r.priority,
                    r.status,
                    r.tags,
                    ts,
                    ts
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        n_req += 1;
        titles.push(r.title.clone());
    }

    for k in &parsed.knowledge {
        if skip_dup && title_exists_kno(&conn, &k.title)? {
            n_skip += 1;
            continue;
        }
        if !dry {
            let ts = k.created_at.clone().unwrap_or_else(now);
            conn.execute(
                "INSERT INTO knowledge (title, body, category, tags, created_at) VALUES (?1,?2,?3,?4,?5)",
                rusqlite::params![k.title, k.body, k.category, k.tags, ts],
            )
            .map_err(|e| e.to_string())?;
        }
        n_kno += 1;
        titles.push(k.title.clone());
    }

    // 还原图片：只写本地还没有的，避免覆盖；空内容直接跳过
    let mut n_img = 0usize;
    for (rel, b64) in &parsed.images {
        if b64.trim().is_empty() || !is_safe_rel_path(rel) {
            continue;
        }
        let target = base.join(rel);
        if target.exists() {
            continue;
        }
        let bytes = match base64::engine::general_purpose::STANDARD.decode(b64.trim()) {
            Ok(b) => b,
            Err(_) => continue,
        };
        if dry {
            n_img += 1;
            continue;
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        if std::fs::write(&target, &bytes).is_ok() {
            n_img += 1;
        }
    }

    Ok(ImportResult {
        format: parsed.format,
        requirements: n_req,
        knowledge: n_kno,
        images: n_img,
        skipped: n_skip,
        missing_images: parsed.missing_images,
        titles: titles.into_iter().take(12).collect(),
        dry_run: dry,
    })
}

fn parse_backup_json(content: &str) -> Result<ParsedImport, String> {
    let backup: BackupFile =
        serde_json::from_str(content).map_err(|e| format!("备份文件解析失败：{}", e))?;
    Ok(ParsedImport {
        format: "json".to_string(),
        requirements: backup.requirements,
        knowledge: backup.knowledge,
        images: backup.images,
        missing_images: 0,
    })
}

fn title_exists_req(conn: &Connection, title: &str) -> Result<bool, String> {
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(1) FROM requirements WHERE title = ?1",
            [title],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(n > 0)
}

fn title_exists_kno(conn: &Connection, title: &str) -> Result<bool, String> {
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(1) FROM knowledge WHERE title = ?1",
            [title],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(n > 0)
}

/// 只接受形如 images/xxx.png 的相对路径，防止备份里的路径写到别处
fn is_safe_rel_path(rel: &str) -> bool {
    if rel.is_empty() || rel.len() > 200 {
        return false;
    }
    if rel.starts_with('/') || rel.starts_with('\\') {
        return false;
    }
    if rel.contains("..") {
        return false;
    }
    rel.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '/'))
}

// ---------- Markdown 解析（尽力还原结构化字段） ----------

/// 拆分导出格式的需求标题：`标题 （类型 / 优先级 / 状态）`
fn split_req_title(raw: &str) -> (String, Option<String>, Option<String>, Option<String>) {
    let pick = |s: &str| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    };

    for (open, close) in [('（', '）'), ('(', ')')] {
        if let Some(start) = raw.rfind(open) {
            if raw.ends_with(close) {
                let inner = &raw[start + open.len_utf8()..raw.len() - close.len_utf8()];
                let parts: Vec<&str> = inner.split('/').collect();
                if parts.len() == 3 {
                    let title = raw[..start].trim().to_string();
                    if !title.is_empty() {
                        return (title, pick(parts[0]), pick(parts[1]), pick(parts[2]));
                    }
                }
            }
        }
    }
    (raw.trim().to_string(), None, None, None)
}

fn parse_markdown_doc(md: &str) -> ParsedImport {
    let mut requirements: Vec<BackupRequirement> = Vec::new();
    let mut knowledge: Vec<BackupKnowledge> = Vec::new();

    let mut section = "knowledge".to_string(); // 未识别时默认归入知识库
    let mut cur_title: Option<String> = None;
    let mut cur_lines: Vec<String> = Vec::new();
    let mut seen_doc_title = false;

    let flush = |title: Option<String>,
                    lines: &Vec<String>,
                    sec: &str,
                    reqs: &mut Vec<BackupRequirement>,
                    know: &mut Vec<BackupKnowledge>| {
        let Some(raw_title) = title else { return };
        let raw_title = raw_title.trim().to_string();
        if raw_title.is_empty() {
            return;
        }
        let body = lines.join("\n").trim().to_string();
        let body = if body.is_empty() { None } else { Some(body) };

        if sec == "requirements" {
            let (t, ty, pr, st) = split_req_title(&raw_title);
            reqs.push(BackupRequirement {
                title: t,
                description: body,
                r#type: ty,
                priority: pr,
                status: st,
                tags: None,
                created_at: Some(now()),
            });
        } else {
            // 从正文里挑出「- 分类：」「- 标签：」这类元信息行
            let mut category: Option<String> = None;
            let mut tags: Option<String> = None;
            let mut rest: Vec<String> = Vec::new();
            for line in lines {
                let t = line.trim();
                if let Some(v) = t.strip_prefix("- 分类：").or_else(|| t.strip_prefix("- 分类:")) {
                    category = pick_value(v);
                } else if let Some(v) =
                    t.strip_prefix("- 标签：").or_else(|| t.strip_prefix("- 标签:"))
                {
                    tags = pick_value(v);
                } else {
                    rest.push(line.clone());
                }
            }
            let body = rest.join("\n").trim().to_string();
            let body = if body.is_empty() { None } else { Some(body) };
            know.push(BackupKnowledge {
                title: raw_title,
                body,
                category,
                tags,
                created_at: Some(now()),
            });
        }
    };

    for line in md.lines() {
        let t = line.trim_end();
        let trimmed = t.trim();

        if let Some(rest) = trimmed.strip_prefix("### ") {
            flush(cur_title.take(), &cur_lines, &section, &mut requirements, &mut knowledge);
            cur_lines.clear();
            cur_title = Some(rest.trim().to_string());
            continue;
        }

        if let Some(rest) = trimmed.strip_prefix("## ") {
            let name = rest.trim();
            flush(cur_title.take(), &cur_lines, &section, &mut requirements, &mut knowledge);
            cur_lines.clear();
            if name.contains("需求") {
                section = "requirements".to_string();
            } else if name.contains("知识") {
                section = "knowledge".to_string();
            } else {
                cur_title = Some(name.to_string());
            }
            continue;
        }

        if let Some(rest) = trimmed.strip_prefix("# ") {
            let name = rest.trim();
            flush(cur_title.take(), &cur_lines, &section, &mut requirements, &mut knowledge);
            cur_lines.clear();
            // 第一个一级标题视为文档标题，不当作条目
            if !seen_doc_title {
                seen_doc_title = true;
            } else if !(name.contains("需求") || name.contains("知识")) {
                cur_title = Some(name.to_string());
            }
            continue;
        }

        if cur_title.is_some() {
            cur_lines.push(t.to_string());
        }
    }

    flush(cur_title.take(), &cur_lines, &section, &mut requirements, &mut knowledge);

    // 顺带统计正文里引用到的本地图片（.md 文件本身不含图片数据，导入后这些引用会失效）
    let mut missing = 0usize;
    for r in &requirements {
        missing += count_image_refs(r.description.as_deref());
    }
    for k in &knowledge {
        missing += count_image_refs(k.body.as_deref());
    }

    ParsedImport {
        format: "markdown".to_string(),
        requirements,
        knowledge,
        images: BTreeMap::new(),
        missing_images: missing,
    }
}

fn pick_value(v: &str) -> Option<String> {
    let t = v.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

/// 统计 Markdown 中引用的本地图片数量
fn count_image_refs(text: Option<&str>) -> usize {
    let Some(text) = text else { return 0 };
    let re = match Regex::new(r"!\[[^\]]*\]\(([^)]+)\)") {
        Ok(r) => r,
        Err(_) => return 0,
    };
    re.captures_iter(text)
        .filter(|c| {
            let src = c[1].trim();
            !src.starts_with("http") && !src.starts_with("data:")
        })
        .count()
}
