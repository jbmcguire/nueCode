import { useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import type { EnvironmentId } from "@t3tools/contracts";

import { parseInspectorRouteSearch, type InspectorTab } from "../inspectorRouteSearch";
import BrowserPanel from "./BrowserPanel";
import DiffPanel from "./DiffPanel";
import { FilesPanel } from "./FilesPanel";
import { InspectorPanelShell, type InspectorPanelMode } from "./InspectorPanelShell";
import { ReviewPanel } from "./ReviewPanel";

interface InspectorPanelProps {
  environmentId: EnvironmentId;
  mode: InspectorPanelMode;
  onClose: () => void;
  onSelectTab: (tab: InspectorTab) => void;
  routeKind: "draft" | "server";
  threadId: string;
  workspaceRoot: string | null;
}

export function InspectorPanel(props: InspectorPanelProps) {
  const inspectorSearch = useSearch({
    strict: false,
    select: (search) => parseInspectorRouteSearch(search),
  });
  const [activeFilePath, setActiveFilePath] = useState<string | null>(
    inspectorSearch.filePath ?? null,
  );
  const activeTab = inspectorSearch.inspectorTab ?? "preview";
  const tabs: ReadonlyArray<{ id: InspectorTab; disabled?: boolean }> = [
    { id: "changes", disabled: props.routeKind !== "server" },
    { id: "review", disabled: props.routeKind !== "server" },
    { id: "preview" },
    { id: "files" },
  ];
  const contextFilePath =
    inspectorSearch.diffFilePath ?? activeFilePath ?? inspectorSearch.filePath ?? null;

  useEffect(() => {
    if (!inspectorSearch.filePath) {
      return;
    }
    setActiveFilePath(inspectorSearch.filePath);
  }, [inspectorSearch.filePath]);

  return (
    <InspectorPanelShell
      mode={props.mode}
      activeTab={activeTab}
      contextFilePath={contextFilePath}
      tabs={tabs}
      onClose={props.onClose}
      onSelectTab={props.onSelectTab}
    >
      <div
        className="flex min-h-0 flex-1"
        data-inspector-panel="true"
        data-inspector-tab={activeTab}
      >
        {activeTab === "preview" ? (
          <BrowserPanel
            embedded
            mode={props.mode}
            threadId={props.threadId}
            onClose={props.onClose}
          />
        ) : null}
        {activeTab === "review" ? <ReviewPanel routeKind={props.routeKind} /> : null}
        {activeTab === "changes" ? <DiffPanel mode="sidebar" /> : null}
        {activeTab === "files" ? (
          <FilesPanel
            active
            environmentId={props.environmentId}
            initialFilePath={activeFilePath}
            onActiveFilePathChange={setActiveFilePath}
            workspaceRoot={props.workspaceRoot}
          />
        ) : null}
      </div>
    </InspectorPanelShell>
  );
}
