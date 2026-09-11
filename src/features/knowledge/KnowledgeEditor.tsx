import { useCallback, useEffect, useMemo, useState } from "react";
import type { Knowledge } from "../../types";
import { emptyKnowledge } from "../../types";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import { toast } from "../../store/toastStore";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import { InlineImagePreview } from "../../components/InlineImagePreview";
import { removeImageRef } from "../../utils/markdown";

function isSameContent(a: Knowledge | null, b: Knowledge | null): boolean {
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    (a.body ?? "") === (b.body ?? "") &&
    (a.category ?? "") === (b.category ?? "") &&
    (a.tags ?? "") === (b.tags ?? "")
  );
}

export function KnowledgeEditor() {
  const items = useKnowledgeStore((s) => s.items);
  const selectedId = useKnowledgeStore((s) => s.selectedId);
  const create = useKnowledgeStore((s) => s.create);
  const update = useKnowledgeStore((s) => s.update);
  const remove = useKnowledgeStore((s) => s.remove);

  const isNew = selectedId === 0;
  const current = isNew
    ? null
    : items.find((k) => k.id === selectedId) || null;

  const [draft, setDraft] = useState<Knowledge | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => {
    if (isNew) {
      return Boolean(
        draft?.title.trim() || draft?.body?.trim() || draft?.category || draft?.tags
      );
    }
    return !isSameContent(draft, current);
  }, [draft, current, isNew]);

  const set = (patch: Partial<Knowledge>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  useEffect(() => {
    if (isNew) setDraft(emptyKnowledge());
    else setDraft(current ? { ...current } : null);
  }, [isNew, current]);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    if (!draft.title.trim()) {
      toast.info("请先填写标题再保存");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await create({ ...draft });
        toast.success("已创建");
      } else {
        await update(draft.id, { ...draft });
        toast.success("已保存");
      }
    } catch (err) {
      console.error("保存知识库失败", err);
      toast.error(`保存失败：${err}`);
    } finally {
      setSaving(false);
    }
  }, [draft, saving, isNew, create, update]);

  // Ctrl/Cmd + S 保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  if (!draft) {
    return <div className="editor empty-editor">从左侧选择一条知识，或新建</div>;
  }

  const del = async () => {
    if (!current) return;
    if (!window.confirm(`确定删除「${current.title}」？此操作不可撤销。`)) return;
    try {
      await remove(current.id);
      toast.success("已删除");
    } catch (err) {
      toast.error(`删除失败：${err}`);
    }
  };

  return (
    <div className="editor">
      <input
        className="field title-field"
        value={draft.title}
        placeholder="标题"
        onChange={(e) => set({ title: e.target.value })}
      />
      <div className="row">
        <label>
          分类
          <input
            value={draft.category ?? ""}
            onChange={(e) => set({ category: e.target.value || null })}
          />
        </label>
        <label>
          标签
          <input
            value={draft.tags ?? ""}
            onChange={(e) => set({ tags: e.target.value || null })}
          />
        </label>
      </div>
      <div className="tabs">
        <button
          className={tab === "edit" ? "tab active" : "tab"}
          onClick={() => setTab("edit")}
        >
          编辑
        </button>
        <button
          className={tab === "preview" ? "tab active" : "tab"}
          onClick={() => setTab("preview")}
        >
          预览
        </button>
      </div>
      {tab === "edit" ? (
        <>
          <MarkdownEditor
            value={draft.body ?? ""}
            onChange={(v) => set({ body: v || null })}
            placeholder="正文（Markdown：支持 # 标题、列表、代码块、表格等，可直接粘贴图片）"
          />
          <InlineImagePreview
            markdown={draft.body ?? ""}
            onRemove={(src) => set({ body: removeImageRef(draft.body ?? "", src) || null })}
          />
        </>
      ) : (
        <MarkdownPreview>{draft.body ?? ""}</MarkdownPreview>
      )}
      <div className="actions">
        <span className={`save-state ${dirty ? "dirty" : "clean"}`}>
          {saving ? "保存中…" : dirty ? "● 有未保存的修改" : "✓ 已是最新"}
        </span>
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? "保存中…" : isNew ? "创建" : "保存"}
        </button>
        {!isNew && (
          <button className="btn danger" onClick={del} disabled={saving}>
            删除
          </button>
        )}
      </div>
    </div>
  );
}
