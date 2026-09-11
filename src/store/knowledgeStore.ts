import { create } from "zustand";
import { api } from "../tauri-api";
import type { Knowledge, SearchKnowledgeInput } from "../types";

type Selection = number | null;

const DEFAULT_PAGE_SIZE = 15;

interface KnowledgeState {
  items: Knowledge[];
  selectedId: Selection;
  loading: boolean;
  keyword: string;
  searchTitle: boolean;
  searchBody: boolean;
  searchCategory: boolean;
  searchTags: boolean;
  page: number;
  pageSize: number;
  total: number;
  load: () => Promise<void>;
  setKeyword: (keyword: string) => void;
  setSearchTitle: (v: boolean) => void;
  setSearchBody: (v: boolean) => void;
  setSearchCategory: (v: boolean) => void;
  setSearchTags: (v: boolean) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  beginCreate: () => void;
  select: (id: number | null) => void;
  create: (input: Partial<Knowledge>) => Promise<void>;
  update: (id: number, input: Partial<Knowledge>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

function buildSearchInput(state: KnowledgeState): SearchKnowledgeInput {
  return {
    keyword: state.keyword.trim(),
    search_title: state.searchTitle,
    search_body: state.searchBody,
    search_category: state.searchCategory,
    search_tags: state.searchTags,
    page: state.page,
    page_size: state.pageSize,
  };
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  items: [],
  selectedId: null,
  loading: false,
  keyword: "",
  searchTitle: true,
  searchBody: true,
  searchCategory: false,
  searchTags: false,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,

  load: async () => {
    set({ loading: true });
    try {
      const res = await api.listKnowledge(buildSearchInput(get()));
      set({ items: res.items, total: res.total });
    } finally {
      set({ loading: false });
    }
  },

  setKeyword: (keyword) => set({ keyword, page: 1 }),
  setSearchTitle: (v) => set({ searchTitle: v, page: 1 }),
  setSearchBody: (v) => set({ searchBody: v, page: 1 }),
  setSearchCategory: (v) => set({ searchCategory: v, page: 1 }),
  setSearchTags: (v) => set({ searchTags: v, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (size) => set({ pageSize: size, page: 1 }),

  beginCreate: () => set({ selectedId: 0 }),
  select: (id) => set({ selectedId: id }),

  create: async (input) => {
    const created = await api.createKnowledge(input);
    await get().load();
    set({ selectedId: created.id });
  },
  update: async (id, input) => {
    await api.updateKnowledge(id, input);
    await get().load();
  },
  remove: async (id) => {
    await api.deleteKnowledge(id);
    if (get().selectedId === id) set({ selectedId: null });
    await get().load();
  },
}));
