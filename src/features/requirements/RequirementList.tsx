import { useEffect } from "react";
import type { Requirement } from "../../types";
import { useRequirementsStore } from "../../store/requirementsStore";
import { Pagination } from "../../components/Pagination";

export function RequirementList() {
  const items = useRequirementsStore((s) => s.items);
  const selectedId = useRequirementsStore((s) => s.selectedId);
  const select = useRequirementsStore((s) => s.select);
  const beginCreate = useRequirementsStore((s) => s.beginCreate);
  const load = useRequirementsStore((s) => s.load);

  const keyword = useRequirementsStore((s) => s.keyword);
  const searchTitle = useRequirementsStore((s) => s.searchTitle);
  const searchDescription = useRequirementsStore((s) => s.searchDescription);
  const searchTags = useRequirementsStore((s) => s.searchTags);
  const page = useRequirementsStore((s) => s.page);
  const pageSize = useRequirementsStore((s) => s.pageSize);
  const total = useRequirementsStore((s) => s.total);

  useEffect(() => {
    load();
  }, [keyword, searchTitle, searchDescription, searchTags, page, pageSize]);

  return (
    <div className="list-pane">
      <div className="list-head">
        <span>需求（{total}）</span>
        <button className="btn small" onClick={beginCreate}>
          + 新建
        </button>
      </div>

      <div className="list-search">
        <input
          className="search-input"
          type="text"
          placeholder="搜索需求..."
          value={keyword}
          onChange={(e) => useRequirementsStore.getState().setKeyword(e.target.value)}
        />
        <div className="search-options">
          <label>
            <input
              type="checkbox"
              checked={searchTitle}
              onChange={(e) => useRequirementsStore.getState().setSearchTitle(e.target.checked)}
            />
            标题
          </label>
          <label>
            <input
              type="checkbox"
              checked={searchDescription}
              onChange={(e) => useRequirementsStore.getState().setSearchDescription(e.target.checked)}
            />
            描述
          </label>
          <label>
            <input
              type="checkbox"
              checked={searchTags}
              onChange={(e) => useRequirementsStore.getState().setSearchTags(e.target.checked)}
            />
            标签
          </label>
        </div>
      </div>

      <ul className="list">
        {items.length === 0 && (
          <li className="empty">
            {keyword.trim() ? "没有匹配的需求" : "暂无需求，点击右上「+ 新建」"}
          </li>
        )}
        {items.map((r: Requirement) => (
          <li
            key={r.id}
            className={"list-item" + (selectedId === r.id ? " active" : "")}
            onClick={() => select(r.id)}
          >
            <div className="list-title">{r.title || "(无标题)"}</div>
            <div className="list-sub">
              {[r.priority, r.status, r.tags]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(p) => useRequirementsStore.getState().setPage(p)}
        onPageSizeChange={(s) => useRequirementsStore.getState().setPageSize(s)}
      />
    </div>
  );
}
