# 需求清单与知识库管理桌面应用 · P0 MVP

基于 **Tauri 2 + React 18 + TypeScript + SQLite** 的 Windows 桌面工具（离线优先）。
P0 目标：录入需求/知识 → 存本地 SQLite → 一键导出 Markdown 的最小可行闭环。

## 目录结构

```
app/
├─ src-tauri/            # Rust 后端（窗口外壳 + SQLite + 命令）
│  ├─ Cargo.toml
│  ├─ tauri.conf.json     # 窗口/打包/WebView2 配置
│  ├─ build.rs
│  ├─ gen_icons.py        # 生成占位图标（已运行，产出 icons/）
│  ├─ icons/              # 32x32 / 128x128 / 256 / icon.ico
│  └─ src/
│     ├─ main.rs          # 入口，托管数据库连接
│     ├─ db.rs            # SQLite 连接与建表（app.db 落 %APPDATA%）
│     └─ commands.rs      # 需求/知识 CRUD + export_markdown
├─ src/                  # React 前端
│  ├─ main.tsx
│  ├─ App.tsx            # 三栏布局（导航 / 列表 / 编辑·预览）
│  ├─ types.ts
│  ├─ tauri-api.ts       # 对 @tauri-apps/api 的类型化封装
│  ├─ store/             # Zustand 状态
│  ├─ features/          # requirements / knowledge / export
│  └─ components/        # 通用 UI（LeftNav）
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
└─ package.json
```

## 运行（需在本机准备环境）

1. 安装 [Rust 工具链](https://rustup.rs/)（stable）与 [Node.js 22+](https://nodejs.org/)。
2. Windows 下 Tauri 2 需要 **Microsoft C++ 生成工具（MSVC）** 与 **WebView2**（安装器已配置 `embedBootstrapper` 自动引导）。
3. 安装依赖并启动：
   ```bash
   cd app
   npm install
   npm run tauri dev      # 开发模式（热更新）
   # 或打包出 EXE：
   npm run tauri build    # 产物在 src-tauri/target/release/bundle/
   ```

## 已实现（P0）

- 需求清单：新增 / 编辑 / 删除 / 列表（类型·优先级·状态·标签）。
- 知识库：Markdown 编辑 + 实时预览 + 列表。
- 本地存储：SQLite 四张表（`requirements` / `knowledge` / `tags` / `links`），库文件位于
  `%APPDATA%/com.example.reqkb/app.db`。
- 导出：整库 / 仅需求 / 仅知识库 → 生成 `.md` 文件，存于 `exports/` 目录。
- 三栏 UI 骨架，模块可在「需求清单 / 知识库 / 导出」间切换。

## 明确不在 P0（见整体方案 P1+）

FTS5 全文检索、Word(.docx) 导出、文件导入、PDF/OCR、LLM 辅助、加密、云同步。

> 说明：所有数据库操作均经 Rust 命令完成，前端不直连数据库——便于后续在命令层加入加密、校验与审计。
