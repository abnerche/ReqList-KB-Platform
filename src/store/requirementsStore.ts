import { create } from "zustand";
import { api } from "../tauri-api";
import type { Requirement, SearchRequirementInput } from "../types";

// 0 作为「新建中」哨兵；null 表示未选中
type Selection = number | null;

const DEFAULT_PAGE_SIZE = 15;

interface RequirementsState {
  items: Requirement[];
  selectedId: Selection;
  loading: boolean;
  keyword: string;
  searchTitle: boolean;
  searchDescription: boolean;
  searchTags: boolean;
  page: number;
  pageSize: number;
  total: number;
  load: () => Promise<void>;
  setKeyword: (keyword: string) => void;
  setSearchTitle: (v: boolean) => void;
  setSearchDescription: (v: boolean) => void;
  setSearchTags: (v: boolean) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  beginCreate: () => void;
  select: (id: number | null) => void;
  create: (input: Partial<Requirement>) => Promise<void>;
  update: (id: number, input: Partial<Requirement>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

function buildSearchInput(state: RequirementsState): SearchRequirementInput {
  return {
    keyword: state.keyword.trim(),
    search_title: state.searchTitle,
    search_description: state.searchDescription,
    search_tags: state.searchTags,
    page: state.page,
    page_size: state.pageSize,
  };
}

export const useRequirementsStore = create<RequirementsState>((set, get) => ({
  items: [],
  selectedId: null,
  loading: false,
  keyword: "",
  searchTitle: true,
  searchDescription: true,
  searchTags: false,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,

  load: async () => {
    set({ loading: true });
    try {
      const res = await api.listRequirements(buildSearchInput(get()));
      set({ items: res.items, total: res.total });
    } finally {
      set({ loading: false });
    }
  },

  setKeyword: (keyword) => set({ keyword, page: 1 }),
  setSearchTitle: (v) => set({ searchTitle: v, page: 1 }),
  setSearchDescription: (v) => set({ searchDescription: v, page: 1 }),
  setSearchTags: (v) => set({ searchTags: v, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (size) => set({ pageSize: size, page: 1 }),

  beginCreate: () => set({ selectedId: 0 }),
  select: (id) => set({ selectedId: id }),

  create: async (input) => {
    const created = await api.createRequirement(input);
    await get().load();
    set({ selectedId: created.id });
  },
  update: async (id, input) => {
    await api.updateRequirement(id, input);
    await get().load();
  },
  remove: async (id) => {
    await api.deleteRequirement(id);
    if (get().selectedId === id) set({ selectedId: null });
    await get().load();
  },
}));
