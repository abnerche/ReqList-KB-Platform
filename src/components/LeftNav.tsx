import type { ModuleKey } from "../types";

const ITEMS: { key: ModuleKey; label: string }[] = [
  { key: "requirements", label: "需求清单" },
  { key: "knowledge", label: "知识库" },
  { key: "export", label: "导出" },
];

export function LeftNav({
  active,
  onSelect,
}: {
  active: ModuleKey;
  onSelect: (k: ModuleKey) => void;
}) {
  return (
    <nav className="left-nav">
      <div className="brand">
        需求清单
        <br />
        与知识库
      </div>
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className={"nav-item" + (active === it.key ? " active" : "")}
          onClick={() => onSelect(it.key)}
        >
          {it.label}
        </button>
      ))}
      <div className="nav-foot">v0.1.0 · P0 MVP</div>
    </nav>
  );
}
