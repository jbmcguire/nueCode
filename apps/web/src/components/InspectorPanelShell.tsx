import type { ReactNode } from "react";

import { FileIcon, GlobeIcon, MessageSquareIcon, Rows3Icon, XIcon } from "lucide-react";

import { isElectron } from "~/env";
import { useTheme } from "~/hooks/useTheme";
import { cn } from "~/lib/utils";

import { VscodeEntryIcon } from "./chat/VscodeEntryIcon";
import type { InspectorTab } from "../inspectorRouteSearch";

const PRIMARY_TABS: readonly InspectorTab[] = ["changes", "review", "preview"];

const INSPECTOR_TAB_LABELS: Record<InspectorTab, string> = {
  preview: "Browser",
  review: "Review",
  changes: "Summary",
  files: "Files",
};

const INSPECTOR_TAB_ICONS = {
  preview: GlobeIcon,
  review: MessageSquareIcon,
  changes: Rows3Icon,
  files: FileIcon,
} satisfies Record<InspectorTab, typeof FileIcon>;

export type InspectorPanelMode = "sheet" | "sidebar";

function headerRowClassName(mode: InspectorPanelMode) {
  const shouldUseDragRegion = isElectron && mode !== "sheet";
  return cn("flex items-center gap-3 px-3", shouldUseDragRegion ? "drag-region h-[54px]" : "h-12");
}

function basenameOf(pathValue: string | null | undefined): string | null {
  if (!pathValue) {
    return null;
  }
  const segments = pathValue.split("/");
  return segments[segments.length - 1] ?? null;
}

export function InspectorPanelShell(props: {
  mode: InspectorPanelMode;
  activeTab: InspectorTab;
  contextFilePath?: string | null;
  onClose: () => void;
  onSelectTab: (tab: InspectorTab) => void;
  tabs: ReadonlyArray<{ id: InspectorTab; disabled?: boolean }>;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const shouldUseDragRegion = isElectron && props.mode !== "sheet";
  const { resolvedTheme } = useTheme();
  const tabsById = new Map(props.tabs.map((tab) => [tab.id, tab]));
  const contextFileName = basenameOf(props.contextFilePath);
  const fileTab = tabsById.get("files");
  const header = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 [-webkit-app-region:no-drag]">
        {PRIMARY_TABS.map((tabId, index) => {
          const tab = tabsById.get(tabId);
          if (!tab) {
            return null;
          }
          const Icon = INSPECTOR_TAB_ICONS[tabId];
          return (
            <div key={tabId} className="flex items-center gap-1.5">
              {index > 0 ? <div className="mx-1 h-4 w-px bg-border/70" /> : null}
              <button
                type="button"
                disabled={tab.disabled}
                onClick={() => props.onSelectTab(tabId)}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium tracking-[-0.01em] transition-all duration-150 ease-out",
                  tabId === props.activeTab
                    ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--border)_72%,transparent)]"
                    : "text-muted-foreground hover:bg-accent/45 hover:text-foreground",
                  tab.disabled && "cursor-not-allowed opacity-35",
                )}
                aria-label={`Open ${INSPECTOR_TAB_LABELS[tabId]} tab`}
              >
                <Icon
                  className={cn(
                    "size-3.5 transition-transform duration-150 ease-out",
                    tabId === props.activeTab
                      ? "text-foreground"
                      : "text-muted-foreground/80 group-hover:text-foreground",
                  )}
                />
                <span>{INSPECTOR_TAB_LABELS[tabId]}</span>
              </button>
            </div>
          );
        })}
        {fileTab ? <div className="mx-2 h-4 w-px bg-border/70" /> : null}
        {fileTab ? (
          <button
            type="button"
            disabled={fileTab.disabled}
            onClick={() => props.onSelectTab("files")}
            className={cn(
              "group inline-flex min-w-0 max-w-[18rem] items-center gap-2 rounded-2xl px-3 py-2 text-[13px] font-medium tracking-[-0.01em] transition-all duration-150 ease-out",
              props.activeTab === "files"
                ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--border)_72%,transparent)]"
                : "bg-card/60 text-muted-foreground hover:bg-accent/45 hover:text-foreground",
              fileTab.disabled && "cursor-not-allowed opacity-35",
            )}
            aria-label={contextFileName ? `Open ${contextFileName}` : "Open files tab"}
          >
            {contextFileName ? (
              <VscodeEntryIcon
                pathValue={contextFileName}
                kind="file"
                theme={resolvedTheme}
                className="size-4 shrink-0"
              />
            ) : (
              <FileIcon className="size-3.5 shrink-0 text-muted-foreground/80 group-hover:text-foreground" />
            )}
            <span className="truncate">{contextFileName ?? INSPECTOR_TAB_LABELS.files}</span>
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={props.onClose}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground [-webkit-app-region:no-drag]"
        aria-label="Close inspector panel"
      >
        <XIcon className="size-3.5" />
      </button>
    </>
  );

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {shouldUseDragRegion ? (
        <div className="border-b border-border/80 bg-[color-mix(in_srgb,var(--background)_90%,black)]">
          <div className={headerRowClassName(props.mode)}>{header}</div>
        </div>
      ) : (
        <div className="border-b border-border/80 bg-[color-mix(in_srgb,var(--background)_90%,black)]">
          <div className={headerRowClassName(props.mode)}>{header}</div>
        </div>
      )}
      {props.toolbar ? <div className="border-b border-border/70">{props.toolbar}</div> : null}
      {props.children}
    </div>
  );
}
