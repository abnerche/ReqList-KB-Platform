import { useCallback, useEffect, useRef } from "react";
import { useImagePaste } from "../hooks/useImagePaste";

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

const INDENT = "  ";

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const pendingSel = useRef<[number, number] | null>(null);
  // 粘贴图片后由上层在渲染完成后设置光标，位置才准确
  const setSel = useCallback((pos: number) => {
    pendingSel.current = [pos, pos];
  }, []);

  // 图片粘贴 hook 必须在任何条件 return 之前调用
  const ref = useImagePaste(value, onChange, setSel);

  // 每次渲染后恢复光标/选区（受控组件更新后才生效）
  useEffect(() => {
    const sel = pendingSel.current;
    if (!sel || !ref.current) return;
    pendingSel.current = null;
    ref.current.focus();
    ref.current.setSelectionRange(sel[0], sel[1]);
  });

  const el = () => ref.current;

  /** 用 text 替换 [start,end)，并把光标放到 sel 位置 */
  const apply = (
    start: number,
    end: number,
    text: string,
    sel?: [number, number]
  ) => {
    onChange(value.slice(0, start) + text + value.slice(end));
    pendingSel.current = sel ?? [start + text.length, start + text.length];
  };

  /** Tab / Shift+Tab 缩进与反缩进，支持多行批量 */
  const handleTab = (dedent: boolean) => {
    const node = el();
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const hasSelection = start !== end;

    if (!dedent && !hasSelection) {
      apply(start, end, INDENT);
      return;
    }

    // 选中区域扩展为整行
    const blockStart = value.lastIndexOf("\n", start - 1) + 1;
    let blockEnd = value.indexOf("\n", end);
    if (blockEnd === -1) blockEnd = value.length;
    const block = value.slice(blockStart, blockEnd);

    if (!dedent && !block.includes("\n")) {
      apply(start, end, INDENT);
      return;
    }

    const lines = block.split("\n");
    let headDelta = 0;
    const newLines = lines.map((line, i) => {
      if (dedent) {
        const m = line.match(/^ {1,2}/);
        const cut = m ? m[0].length : 0;
        if (i === 0) headDelta = -cut;
        return line.slice(cut);
      }
      if (i === 0) headDelta = INDENT.length;
      return INDENT + line;
    });

    const newBlock = newLines.join("\n");
    onChange(value.slice(0, blockStart) + newBlock + value.slice(blockEnd));
    const ns = Math.max(blockStart, start + headDelta);
    const ne = end + (newBlock.length - block.length);
    pendingSel.current = [ns, Math.max(ns, ne)];
  };

  /** Enter 自动延续列表 / 引用；空列表项则退出列表。返回是否已处理 */
  const handleEnter = () => {
    const node = el();
    if (!node) return false;
    const start = node.selectionStart;
    if (start !== node.selectionEnd) return false;

    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const line = value.slice(lineStart, start);
    const m = line.match(/^(\s*)([-*+]|\d+\.|>)(\s+)/);
    if (!m) return false;

    const indent = m[1];
    const marker = m[2];
    const content = line.slice(m[0].length);

    // 空列表项：清掉标记，退出列表
    if (!content.trim()) {
      onChange(value.slice(0, lineStart) + value.slice(start));
      pendingSel.current = [lineStart, lineStart];
      return true;
    }

    const nextMarker = /^\d+$/.test(marker) ? `${Number(marker) + 1}.` : marker;
    const insert = `\n${indent}${nextMarker} `;
    onChange(value.slice(0, start) + insert + value.slice(node.selectionEnd));
    pendingSel.current = [start + insert.length, start + insert.length];
    return true;
  };

  /** 给选中的文本加包裹（加粗/斜体/行内代码等） */
  const wrap = (left: string, right = left, placeholderText = "") => {
    const node = el();
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const sel = value.slice(start, end) || placeholderText;
    apply(start, end, left + sel + right, [
      start + left.length,
      start + left.length + sel.length,
    ]);
  };

  /** 插入链接，并选中 URL 部分方便直接输入 */
  const insertLink = () => {
    const node = el();
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const sel = value.slice(start, end) || "链接文本";
    const text = `[${sel}](url)`;
    const urlStart = start + sel.length + 3;
    apply(start, end, text, [urlStart, urlStart + 3]);
  };

  /** 切换当前行前缀（标题 / 列表 / 引用 / 任务） */
  const toggleLinePrefix = (prefix: string) => {
    const node = el();
    if (!node) return;
    const start = node.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = value.indexOf("\n", start);
    if (lineEnd === -1) lineEnd = value.length;

    const line = value.slice(lineStart, lineEnd);
    const stripped = line.replace(/^(#{1,6} |> |\[ \] |\[x\] |[-*+] |\d+\. )/, "");
    const newLine = stripped.startsWith(prefix)
      ? stripped.slice(prefix.length)
      : prefix + stripped;

    onChange(value.slice(0, lineStart) + newLine + value.slice(lineEnd));
    const delta = newLine.length - line.length;
    pendingSel.current = [node.selectionStart + delta, node.selectionEnd + delta];
  };

  /** 插入代码块 */
  const insertCodeBlock = () => {
    const node = el();
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const sel = value.slice(start, end);
    const needBreak = start > 0 && value[start - 1] !== "\n";
    const head = (needBreak ? "\n" : "") + "```\n";
    const text = `${head}${sel}\n\`\`\`\n`;
    const inner = start + head.length;
    apply(start, end, text, [inner, inner + sel.length]);
  };

  /** 插入表格模板 */
  const insertTable = () => {
    const node = el();
    if (!node) return;
    const start = node.selectionStart;
    const needBreak = start > 0 && value[start - 1] !== "\n";
    const tpl = `${needBreak ? "\n" : ""}| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|  |  |  |\n`;
    const inner = start + (needBreak ? 1 : 0) + 2;
    apply(start, start, tpl, [inner, inner + 4]);
  };

  /** Ctrl+D 复制当前行 */
  const duplicateLine = () => {
    const node = el();
    if (!node) return;
    const start = node.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = value.indexOf("\n", start);
    if (lineEnd === -1) lineEnd = value.length;
    const line = value.slice(lineStart, lineEnd);
    const insert = `\n${line}`;
    apply(lineEnd, lineEnd, insert, [lineEnd + insert.length, lineEnd + insert.length]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (e.key === "Tab") {
      e.preventDefault();
      handleTab(e.shiftKey);
      return;
    }
    if (mod && key === "b") {
      e.preventDefault();
      wrap("**", "**", "粗体");
      return;
    }
    if (mod && key === "i") {
      e.preventDefault();
      wrap("*", "*", "斜体");
      return;
    }
    if (mod && key === "k") {
      e.preventDefault();
      insertLink();
      return;
    }
    if (mod && key === "e") {
      e.preventDefault();
      wrap("`", "`", "代码");
      return;
    }
    if (mod && key === "d") {
      e.preventDefault();
      duplicateLine();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !mod) {
      if (handleEnter()) e.preventDefault();
    }
  };

  // 工具栏按钮：mousedown 阻止默认行为，避免 textarea 失焦丢失选区
  const stop = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        <button type="button" onMouseDown={stop} onClick={() => wrap("**", "**", "粗体")} title="加粗 (Ctrl+B)">
          <b>B</b>
        </button>
        <button type="button" onMouseDown={stop} onClick={() => wrap("*", "*", "斜体")} title="斜体 (Ctrl+I)">
          <i>I</i>
        </button>
        <button type="button" onMouseDown={stop} onClick={() => toggleLinePrefix("# ")} title="一级标题">
          H1
        </button>
        <button type="button" onMouseDown={stop} onClick={() => toggleLinePrefix("## ")} title="二级标题">
          H2
        </button>
        <button type="button" onMouseDown={stop} onClick={() => toggleLinePrefix("- ")} title="无序列表">
          • 列表
        </button>
        <button type="button" onMouseDown={stop} onClick={() => toggleLinePrefix("1. ")} title="有序列表">
          1. 列表
        </button>
        <button type="button" onMouseDown={stop} onClick={() => toggleLinePrefix("> ")} title="引用">
          ❝ 引用
        </button>
        <button type="button" onMouseDown={stop} onClick={() => toggleLinePrefix("[ ] ")} title="待办项">
          ☐ 待办
        </button>
        <button type="button" onMouseDown={stop} onClick={insertCodeBlock} title="代码块">
          {"</>"}
        </button>
        <button type="button" onMouseDown={stop} onClick={insertTable} title="插入表格">
          表格
        </button>
        <button type="button" onMouseDown={stop} onClick={insertLink} title="链接 (Ctrl+K)">
          链接
        </button>
        <span className="md-toolbar-tip">可直接粘贴图片</span>
      </div>
      <textarea
        ref={ref}
        className="field md-textarea"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      <div className="md-status">
        <span>{value.length} 字符</span>
        <span>Tab 缩进 · Shift+Tab 反缩进 · Enter 续列表 · Ctrl+B/I/K/E/D</span>
      </div>
    </div>
  );
}
