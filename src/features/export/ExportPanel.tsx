import { useEffect, useState } from "react";
import { api, type ExportScope, type ExportFormat } from "../../tauri-api";
import { toast } from "../../store/toastStore";
import { useRequirementsStore } from "../../store/requirementsStore";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import type { ImportResult, ImportMode } from "../../types";

const DIR_KEY = "reqkb-export-dir";

export function ExportPanel() {
  const [scope, setScope] = useState<ExportScope>("all");
  const [format, setFormat] = useState<ExportFormat>("md");
  const [exportDir, setExportDir] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [importPath, setImportPath] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("skip");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadReqs = useRequirementsStore((s) => s.load);
  const loadKnow = useKnowledgeStore((s) => s.load);

  useEffect(() => {
    const saved = localStorage.getItem(DIR_KEY);
    if (saved) setExportDir(saved);
  }, []);

  const chooseDir = async () => {
    try {
      const dir = await api.selectExportDir();
      if (dir) {
        setExportDir(dir);
        localStorage.setItem(DIR_KEY, dir);
      }
    } catch (e) {
      toast.error("选择目录失败：" + String(e));
    }
  };

  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      const dir = exportDir.trim() || undefined;
      const path =
        format === "md"
          ? await api.exportMarkdown(scope, dir)
          : format === "docx"
          ? await api.exportWord(scope, dir)
          : await api.exportBackup(scope, dir);
      const label =
        format === "md" ? "Markdown" : format === "docx" ? "Word" : "JSON 备份";
      setMsg(`已导出 ${label}：\n${path}`);
      toast.success(`导出成功（${label}）：${path}`);
    } catch (e) {
      const text = "导出失败：" + String(e);
      setMsg(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  };

  // ---------- 导入 ----------

  const doPreview = async (path: string, mode: ImportMode) => {
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await api.previewImport(path, mode);
      setPreview(res);
    } catch (e) {
      toast.error("解析失败：" + String(e));
    } finally {
      setPreviewing(false);
    }
  };

  const pickFile = async () => {
    try {
      const path = await api.selectImportFile();
      if (!path) return;
      setImportPath(path);
      await doPreview(path, importMode);
    } catch (e) {
      toast.error("选择文件失败：" + String(e));
    }
  };

  const changeMode = async (mode: ImportMode) => {
    setImportMode(mode);
    if (importPath) await doPreview(importPath, mode);
  };

  const doImport = async () => {
    if (!importPath) return;
    setImporting(true);
    try {
      const res = await api.runImport(importPath, importMode);
      const parts = [
        `需求 ${res.requirements} 条`,
        `知识 ${res.knowledge} 条`,
      ];
      if (res.images > 0) parts.push(`图片 ${res.images} 张`);
      if (res.skipped > 0) parts.push(`跳过重名 ${res.skipped} 条`);
      toast.success(`导入完成：${parts.join("，")}`);
      if (res.missing_images > 0) {
        toast.info(
          `该文件引用了 ${res.missing_images} 张本地图片，但 Markdown 本身不含图片数据，导入后这些图片无法显示。建议改用 JSON 备份交换。`
        );
      }
      setPreview(null);
      setImportPath("");
      await loadReqs();
      await loadKnow();
    } catch (e) {
      toast.error("导入失败：" + String(e));
    } finally {
      setImporting(false);
    }
  };

  const total = preview ? preview.requirements + preview.knowledge : 0;

  return (
    <div className="export-panel">
      <h2>导出</h2>
      <p className="hint">
        可选择导出目录与格式。未选择目录时，默认保存到应用数据目录的 exports/
        下（<code>%APPDATA%/com.example.reqkb/exports</code>）。
        <br />
        要把内容<b>发给别人并让他能完整还原</b>，请用
        <b>「JSON 备份（含图片，可导入）」</b>——Markdown / Word 里的图片只是本地路径引用，对方机器上没有图。
      </p>

      <div className="form-row">
        <label>
          导出范围
          <select value={scope} onChange={(e) => setScope(e.target.value as ExportScope)}>
            <option value="all">全部</option>
            <option value="requirements">仅需求清单</option>
            <option value="knowledge">仅知识库</option>
          </select>
        </label>
        <label>
          导出格式
          <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            <option value="md">Markdown</option>
            <option value="docx">Word（.docx）</option>
            <option value="json">JSON 备份（含图片，可导入）</option>
          </select>
        </label>
      </div>

      <div className="dir-row">
        <input
          className="field dir-field"
          value={exportDir}
          onChange={(e) => {
            setExportDir(e.target.value);
            localStorage.setItem(DIR_KEY, e.target.value);
          }}
          placeholder="导出目录（留空使用默认）"
        />
        <button className="btn" onClick={chooseDir} disabled={busy}>
          选择目录
        </button>
      </div>

      <div className="actions">
        <button className="btn primary" disabled={busy} onClick={run}>
          {busy ? "导出中…" : "导出"}
        </button>
      </div>

      {msg && <pre className="export-msg">{msg}</pre>}

      <hr className="panel-sep" />

      <h2>导入</h2>
      <p className="hint">
        支持本应用导出的 <code>.json</code> 备份（含图片，推荐），以及
        <code>.md</code> 文件（会按标题切分条目，尽力还原类型/优先级/状态/分类/标签）。
      </p>

      <div className="form-row">
        <label>
          重名处理
          <select value={importMode} onChange={(e) => changeMode(e.target.value as ImportMode)}>
            <option value="skip">跳过同名条目（推荐）</option>
            <option value="append">全部追加（允许重复）</option>
          </select>
        </label>
      </div>

      <div className="dir-row">
        <input
          className="field dir-field"
          value={importPath}
          readOnly
          placeholder="尚未选择文件"
        />
        <button className="btn" onClick={pickFile} disabled={previewing || importing}>
          选择文件
        </button>
      </div>

      {previewing && <p className="hint">正在解析…</p>}

      {preview && !previewing && (
        <div className="import-preview">
          {total === 0 ? (
            <p className="hint">未能从该文件识别出任何条目，请确认文件格式。</p>
          ) : (
            <>
              <p className="import-summary">
                识别为 <b>{preview.format === "json" ? "JSON 备份" : "Markdown"}</b>，
                将导入 <b>{preview.requirements}</b> 条需求、
                <b>{preview.knowledge}</b> 条知识
                {preview.images > 0 && <>、还原 <b>{preview.images}</b> 张图片</>}
                {preview.skipped > 0 && <>，跳过 <b>{preview.skipped}</b> 条重名</>}
                {preview.missing_images > 0 && (
                  <>，另有 <b>{preview.missing_images}</b> 张图片引用无法还原</>
                )}
              </p>
              {preview.titles.length > 0 && (
                <ul className="import-titles">
                  {preview.titles.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                  {total > preview.titles.length && (
                    <li className="more">…等共 {total} 条</li>
                  )}
                </ul>
              )}
              <div className="actions">
                <button className="btn primary" onClick={doImport} disabled={importing}>
                  {importing ? "导入中…" : "确认导入"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
