import ReactMarkdown from "react-markdown";
import { LightboxImage } from "./ImageLightbox";

function LocalImg({ src, alt }: { src?: string; alt?: string }) {
  return <LightboxImage src={src} alt={alt} style={{ maxWidth: "100%", height: "auto" }} />;
}

export function MarkdownPreview({ children }: { children: string }) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown components={{ img: LocalImg }}>
        {children && children.trim() ? children : "_（空）_"}
      </ReactMarkdown>
    </div>
  );
}
