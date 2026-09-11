import { useMemo, useState } from "react";
import { LightboxImage } from "./ImageLightbox";

const IMG_RE = /!\[[^\]]*\]\(([^)]+)\)/g;
const STORAGE_KEY = "reqkb.imgPreviewExpanded";

interface InlineImagePreviewProps {
  markdown: string;
  onRemove?: (src: string) => void;
}

function loadExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function InlineImagePreview({ markdown, onRemove }: InlineImagePreviewProps) {
  const [expanded, setExpanded] = useState<boolean>(loadExpanded);

  const srcs = useMemo(() => {
    const matches = Array.from(markdown.matchAll(IMG_RE)).map((m) => m[1]);
    return Array.from(new Set(matches));
  }, [markdown]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* 忽略存储失败 */
    }
  };

  if (srcs.length === 0) return null;

  return (
    <div className={`inline-image-preview ${expanded ? "expanded" : "collapsed"}`}>
      <div className="inline-image-head">
        <span className="inline-image-label">
          本段引用图片（{srcs.length} 张）{expanded ? "，点击缩略图可放大" : ""}
        </span>
        <button type="button" className="link-btn" onClick={toggle}>
          {expanded ? "收起" : "展开"}
        </button>
      </div>
      <div className="inline-image-list">
        {srcs.map((src) => (
          <div className="inline-image-item" key={src}>
            <LightboxImage src={src} alt={src} className="inline-image-thumb" />
            {expanded && onRemove && (
              <button
                type="button"
                className="inline-image-remove"
                title="从正文中移除该图片引用"
                onClick={() => onRemove(src)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
