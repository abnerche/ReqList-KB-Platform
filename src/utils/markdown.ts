const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 从 Markdown 文本中移除指定图片的引用 `![alt](src)`，
 * 并清理因删除留下的多余空行。
 */
export function removeImageRef(markdown: string, src: string): string {
  const re = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(src)}\\)`, "g");
  return markdown
    .replace(re, "")
    .replace(/[ \t]*\n[ \t]*\n[ \t]*\n/g, "\n\n")
    .replace(/^\n+/, "");
}
