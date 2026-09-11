import { useEffect, useState } from "react";
import type { ModuleKey } from "./types";
import { LeftNav } from "./components/LeftNav";
import { RequirementList } from "./features/requirements/RequirementList";
import { RequirementEditor } from "./features/requirements/RequirementEditor";
import { KnowledgeList } from "./features/knowledge/KnowledgeList";
import { KnowledgeEditor } from "./features/knowledge/KnowledgeEditor";
import { ExportPanel } from "./features/export/ExportPanel";
import { ToastHost } from "./components/ToastHost";
import { useRequirementsStore } from "./store/requirementsStore";
import { useKnowledgeStore } from "./store/knowledgeStore";

export default function App() {
  const [active, setActive] = useState<ModuleKey>("requirements");
  const loadReqs = useRequirementsStore((s) => s.load);
  const loadKnow = useKnowledgeStore((s) => s.load);

  useEffect(() => {
    if (active === "requirements") loadReqs();
    if (active === "knowledge") loadKnow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="app">
      <LeftNav active={active} onSelect={setActive} />
      <section className="col center">
        {active === "requirements" && <RequirementList />}
        {active === "knowledge" && <KnowledgeList />}
        {active === "export" && <ExportPanel />}
      </section>
      <section className="col right">
        {active === "requirements" && <RequirementEditor />}
        {active === "knowledge" && <KnowledgeEditor />}
        {active === "export" && (
          <div className="empty-editor">导出无需编辑区。</div>
        )}
      </section>
      <ToastHost />
    </div>
  );
}
