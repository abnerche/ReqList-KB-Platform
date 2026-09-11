import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";

interface LightboxImageProps {
  src?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

function resolveImageSrc(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (/^(https?:|data:|asset:|blob:|file:)/i.test(raw)) return raw;
  return undefined;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 10;

export function LightboxImage({ src: rawSrc, alt, className, style }: LightboxImageProps) {
  const [src, setSrc] = useState<string | undefined>(resolveImageSrc(rawSrc));
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    const resolved = resolveImageSrc(rawSrc);
    if (resolved) {
      setSrc(resolved);
      return;
    }
    if (!rawSrc) {
      setSrc(undefined);
      return;
    }
    (async () => {
      try {
        const base = await appDataDir();
        const full = await join(base, rawSrc);
        const url = convertFileSrc(full);
        if (!cancelled) setSrc(url);
      } catch {
        if (!cancelled) setSrc(rawSrc);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawSrc]);

  useEffect(() => {
    if (!open) return;
    setStatus("loading");
    setScale(1);
    setPos({ x: 0, y: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => clampScale(prev * delta));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => (prev > 1 ? 1 : 3));
    setPos({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPos({ x: posStart.current.x + dx, y: posStart.current.y + dy });
  };

  const endDrag = (e?: React.MouseEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    e?.stopPropagation();
  };

  const zoomIn = () => setScale((s) => clampScale(s * 1.25));
  const zoomOut = () => setScale((s) => clampScale(s / 1.25));
  const reset = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  if (!src) return null;

  const percent = Math.round(scale * 100);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ ...style, cursor: "zoom-in" }}
        onClick={() => setOpen(true)}
        title="点击放大"
      />
      {open && (
        <div
          className="image-lightbox-overlay"
          onClick={close}
          onWheel={handleWheel}
          role="dialog"
          aria-label="图片预览"
        >
          <div className="image-lightbox-toolbar">
            <button type="button" onClick={(e) => { e.stopPropagation(); zoomOut(); }} title="缩小">-</button>
            <span>{percent}%</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); zoomIn(); }} title="放大">+</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); reset(); }} title="重置">↺</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); close(); }} title="关闭 (ESC)">✕</button>
          </div>

          {status === "loading" && (
            <div className="image-lightbox-status">图片加载中…</div>
          )}
          {status === "error" && (
            <div className="image-lightbox-status">
              图片加载失败
              <br />
              <small>{src}</small>
            </div>
          )}

          <img
            src={src}
            alt={alt}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onLoad={() => setStatus("ok")}
            onError={() => setStatus("error")}
            style={{
              display: status === "ok" ? "block" : "none",
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              cursor: dragging.current ? "grabbing" : "grab",
            }}
          />

          <div className="image-lightbox-hint">
            滚轮缩放 · 拖拽平移 · 双击{scale > 1 ? "还原" : "放大"} · ESC 关闭
          </div>
        </div>
      )}
    </>
  );
}
