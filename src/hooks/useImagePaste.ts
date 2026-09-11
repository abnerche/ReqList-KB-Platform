import { useEffect, useRef } from "react";
import { api } from "../tauri-api";

export function useImagePaste(
  value: string,
  onChange: (value: string) => void,
  setSelection?: (pos: number) => void
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result as string;
            try {
              const rel = await api.saveImage(dataUrl);
              const start = el.selectionStart ?? 0;
              const end = el.selectionEnd ?? start;
              const before = value.slice(0, start);
              const after = value.slice(end);
              // 让图片语法独占一行，避免和文字挤在一起
              const lead = before && !before.endsWith("\n") ? "\n" : "";
              const tail = after && !after.startsWith("\n") ? "\n" : "";
              const insertText = `${lead}![图片](${rel})${tail}`;
              const newValue = before + insertText + after;
              onChange(newValue);
              const pos = start + insertText.length;
              // 光标后置：优先交给上层（渲染后再设，位置才准确）
              if (setSelection) {
                setSelection(pos);
              } else {
                Promise.resolve().then(() => {
                  el.selectionStart = el.selectionEnd = pos;
                  el.focus();
                });
              }
            } catch (err) {
              console.error("保存图片失败", err);
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    el.addEventListener("paste", handler);
    return () => el.removeEventListener("paste", handler);
  }, [value, onChange, setSelection, ref]);

  return ref;
}
