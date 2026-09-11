import { useEffect } from "react";
import type { Knowledge } from "../../types";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import { Pagination } from "../../components/Pagination";

export function KnowledgeList() {
  const items = useKnowledgeStore((s) => s.items);
  const selectedId = useKnowledgeStore((s) => s.selectedId);
  const select = useKnowledgeStore((s) => s.select);
  const beginCreate = useKnowledgeStore((s) => s.beginCreate);
  const load = useKnowledgeStore((s) => s.load);

  const keyword = useKnowledgeStore((s) => s.keyword);
  const searchTitle = useKnowledgeStore((s) => s.searchTitle);
  const searchBody = useKnowledgeStore((s) => s.searchBody);
  const searchCategory = useKnowledgeStore((s) => s.searchCategory);
  const searchTags = useKnowledgeStore((s) => s.searchTags);
  const page = useKnowledgeStore((s) => s.page);
  const pageSize = useKnowledgeStore((s) => s.pageSize);
  const total = useKnowledgeStore((s) => s.total);

  useEffect(() => {
    load();
  }, [keyword, searchTitle, searchBody, searchCategory, searchTags, page, pageSize]);

  return (
    <div className="list-pane">
      <div className="list-head">
        <span>知识库（{total}）</span>
        <button className="btn small" onClick={beginCreate}>
          + 新建
        </button>
      </div>

      <div className="list-search">
        <input
          className="search-input"
          type="text"
          placeholder="搜索知识库..."
          value={keyword}
          onChange={(e) => useKnowledgeStore.getState().setKeyword(e.target.value)}
        />
        <div className="search-options">
          <label>
            <input
              type="checkbox"
              checked={searchTitle}
              onChange={(e) => useKnowledgeStore.getState().setSearchTitle(e.target.checked)}
            />
            标题
          </label>
          <label>
            <input
              type="checkbox"
              checked={searchBody}
              onChange={(e) => useKnowledgeStore.getState().setSearchBody(e.target.checked)}
            />
            正文
          </label>
          <label>
            <input
              type="checkbox"
              checked={searchCategory}
              onChange={(e) => useKnowledgeStore.getState().setSearchCategory(e.target.checked)}
            />
            分类
          </label>
          <label>
            <input
              type="checkbox"
              checked={searchTags}
              onChange={(e) => useKnowledgeStore.getState().setSearchTags(e.target.checked)}
            />
            标签
          </label>
        </div>
      </div>

      <ul className="list">
        {items.length === 0 && (
          <li className="empty">
            {keyword.trim() ? "没有匹配的知识条目" : "暂无条目，点击右上「+ 新建」"}
          </li>
        )}
        {items.map((k: Knowledge) => (
          <li
            key={k.id}
            className={"list-item" + (selectedId === k.id ? " active" : "")}
            onClick={() => select(k.id)}
          >
            <div className="list-title">{k.title || "(无标题)"}</div>
            <div className="list-sub">
              {[k.category, k.tags].filter(Boolean).join(" · ")}
            </div>
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(p) => useKnowledgeStore.getState().setPage(p)}
        onPageSizeChange={(s) => useKnowledgeStore.getState().setPageSize(s)}
      />
    </div>
  );
}
