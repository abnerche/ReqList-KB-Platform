import { useCallback, useEffect, useMemo, useState } from "react";
import type { Requirement } from "../../types";
import { emptyRequirement } from "../../types";
import { useRequirementsStore } from "../../store/requirementsStore";
import { toast } from "../../store/toastStore";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import { InlineImagePreview } from "../../components/InlineImagePreview";
import { removeImageRef } from "../../utils/markdown";

const TYPES = ["功能", "缺陷", "优化", "调研"];
const PRIORITIES = ["P0", "P1", "P2", "P3"];
const STATUSES = ["待办", "进行中", "已完成", "已搁置"];

function isSameContent(a: Requirement | null, b: Requirement | null): boolean {
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    (a.description ?? "") === (b.description ?? "") &&
    (a.type ?? "") === (b.type ?? "") &&
    (a.priority ?? "") === (b.priority ?? "") &&
    (a.status ?? "") === (b.status ?? "") &&
    (a.tags ?? "") === (b.tags ?? "")
  );
}

export function RequirementEditor() {
  const items = useRequirementsStore((s) => s.items);
  const selectedId = useRequirementsStore((s) => s.selectedId);
  const create = useRequirementsStore((s) => s.create);
  const update = useRequirementsStore((s) => s.update);
  const remove = useRequirementsStore((s) => s.remove);

  const isNew = selectedId === 0;
  const current = isNew
    ? null
    : items.find((r) => r.id === selectedId) || null;

  const [draft, setDraft] = useState<Requirement | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => {
    if (isNew) {
      return Boolean(
        draft?.title.trim() ||
          draft?.description?.trim() ||
          draft?.type ||
          draft?.priority ||
          draft?.status ||
          draft?.tags
      );
    }
    return !isSameContent(draft, current);
  }, [draft, current, isNew]);

  const set = (patch: Partial<Requirement>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  useEffect(() => {
    if (isNew) setDraft(emptyRequirement());
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
      console.error("保存需求失败", err);
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
    return <div className="editor empty-editor">从左侧选择一条需求，或新建</div>;
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
          类型
          <select
            value={draft.type ?? ""}
            onChange={(e) => set({ type: e.target.value || null })}
          >
            <option value="">（未设）</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          优先级
          <select
            value={draft.priority ?? ""}
            onChange={(e) => set({ priority: e.target.value || null })}
          >
            <option value="">（未设）</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          状态
          <select
            value={draft.status ?? ""}
            onChange={(e) => set({ status: e.target.value || null })}
          >
            <option value="">（未设）</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="full">
        标签（逗号分隔）
        <input
          value={draft.tags ?? ""}
          onChange={(e) => set({ tags: e.target.value || null })}
        />
      </label>
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
            value={draft.description ?? ""}
            onChange={(v) => set({ description: v || null })}
            placeholder="需求描述（支持 Markdown，可直接粘贴图片）"
          />
          <InlineImagePreview
            markdown={draft.description ?? ""}
            onRemove={(src) =>
              set({ description: removeImageRef(draft.description ?? "", src) || null })
            }
          />
        </>
      ) : (
        <MarkdownPreview>{draft.description ?? ""}</MarkdownPreview>
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
