import type { ReactNode } from "react";

import { isElectron } from "~/env";
import { cn } from "~/lib/utils";

import { Skeleton } from "./ui/skeleton";

export type BrowserPanelMode = "sheet" | "sidebar";

function getBrowserPanelHeaderRowClassName(mode: BrowserPanelMode) {
  const shouldUseDragRegion = isElectron && mode !== "sheet";
  return cn(
    "flex items-center gap-1.5 px-2",
    shouldUseDragRegion ? "drag-region h-[52px] border-b border-border" : "h-10",
  );
}

export function BrowserPanelShell(props: {
  mode: BrowserPanelMode;
  header: ReactNode;
  children: ReactNode;
}) {
  const shouldUseDragRegion = isElectron && props.mode !== "sheet";

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {shouldUseDragRegion ? (
        <div className={getBrowserPanelHeaderRowClassName(props.mode)}>{props.header}</div>
      ) : (
        <div className="border-b border-border">
          <div className={getBrowserPanelHeaderRowClassName(props.mode)}>{props.header}</div>
        </div>
      )}
      {props.children}
    </div>
  );
}

export function BrowserPanelHeaderSkeleton() {
  return (
    <>
      <div className="flex gap-1">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="size-6 rounded-md" />
      </div>
      <Skeleton className="h-7 flex-1 rounded-md" />
      <Skeleton className="size-6 rounded-md" />
    </>
  );
}

export function BrowserPanelLoadingState(props: { label: string }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-label={props.label}
    >
      <Skeleton className="h-8 w-8 rounded-full" />
      <span className="text-sm">{props.label}</span>
    </div>
  );
}
