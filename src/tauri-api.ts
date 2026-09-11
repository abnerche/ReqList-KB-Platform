import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  Requirement,
  Knowledge,
  Paginated,
  SearchRequirementInput,
  SearchKnowledgeInput,
  ImportResult,
  ImportMode,
} from "./types";

export type ExportScope = "all" | "requirements" | "knowledge";
export type ExportFormat = "md" | "docx" | "json";

export const api = {
  listRequirements: (input: SearchRequirementInput) =>
    invoke<Paginated<Requirement>>("list_requirements", { input }),
  createRequirement: (input: Partial<Requirement>) =>
    invoke<Requirement>("create_requirement", { input }),
  updateRequirement: (id: number, input: Partial<Requirement>) =>
    invoke<Requirement>("update_requirement", { id, input }),
  deleteRequirement: (id: number) => invoke<void>("delete_requirement", { id }),

  listKnowledge: (input: SearchKnowledgeInput) =>
    invoke<Paginated<Knowledge>>("list_knowledge", { input }),
  createKnowledge: (input: Partial<Knowledge>) =>
    invoke<Knowledge>("create_knowledge", { input }),
  updateKnowledge: (id: number, input: Partial<Knowledge>) =>
    invoke<Knowledge>("update_knowledge", { id, input }),
  deleteKnowledge: (id: number) => invoke<void>("delete_knowledge", { id }),

  saveImage: (data: string) => invoke<string>("save_image", { data }),

  selectExportDir: () => open({ directory: true }) as Promise<string | null>,

  selectImportFile: () =>
    open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "备份或 Markdown",
          extensions: ["json", "md", "markdown", "txt"],
        },
      ],
    }) as Promise<string | null>,

  exportMarkdown: (scope: ExportScope, exportDir?: string) =>
    invoke<string>("export_markdown", { scope, exportDir }),
  exportWord: (scope: ExportScope, exportDir?: string) =>
    invoke<string>("export_word", { scope, exportDir }),
  exportBackup: (scope: ExportScope, exportDir?: string) =>
    invoke<string>("export_backup", { scope, exportDir }),

  /** dryRun=true 只做解析预览，不写库 */
  previewImport: (path: string, mode: ImportMode) =>
    invoke<ImportResult>("import_file", { path, mode, dryRun: true }),
  runImport: (path: string, mode: ImportMode) =>
    invoke<ImportResult>("import_file", { path, mode, dryRun: false }),
};
