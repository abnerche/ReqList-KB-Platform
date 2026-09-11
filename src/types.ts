export type ReqType = "功能" | "缺陷" | "优化" | "调研";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type Status = "待办" | "进行中" | "已完成" | "已搁置";

export interface Requirement {
  id: number;
  title: string;
  description: string | null;
  type: string | null;
  priority: string | null;
  status: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface Knowledge {
  id: number;
  title: string;
  body: string | null;
  category: string | null;
  tags: string | null;
  created_at: string;
}

export type ModuleKey = "requirements" | "knowledge" | "export";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface SearchRequirementInput {
  keyword: string;
  search_title: boolean;
  search_description: boolean;
  search_tags: boolean;
  page: number;
  page_size: number;
}

export interface SearchKnowledgeInput {
  keyword: string;
  search_title: boolean;
  search_body: boolean;
  search_category: boolean;
  search_tags: boolean;
  page: number;
  page_size: number;
}

/** 导入结果（预览与正式导入共用） */
export interface ImportResult {
  format: string;
  requirements: number;
  knowledge: number;
  images: number;
  skipped: number;
  missing_images: number;
  titles: string[];
  dry_run: boolean;
}

/** 重名处理策略：跳过同名条目 / 全部追加 */
export type ImportMode = "skip" | "append";

/** 新建草稿用的空白需求对象（id=0 作为「新建中」哨兵） */
export function emptyRequirement(): Requirement {
  return {
    id: 0,
    title: "",
    description: null,
    type: null,
    priority: null,
    status: null,
    tags: null,
    created_at: "",
    updated_at: "",
  };
}

/** 新建草稿用的空白知识对象 */
export function emptyKnowledge(): Knowledge {
  return {
    id: 0,
    title: "",
    body: null,
    category: null,
    tags: null,
    created_at: "",
  };
}
