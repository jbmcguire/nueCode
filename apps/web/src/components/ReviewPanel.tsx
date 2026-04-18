import { useQuery } from "@tanstack/react-query";
import type { TurnId } from "@t3tools/contracts";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useMemo } from "react";

import { openInPreferredEditor } from "../editorPreferences";
import { ensureLocalApi } from "../localApi";
import { parseDiffRouteSearch, stripDiffSearchParams } from "../diffRouteSearch";
import { useTheme } from "../hooks/useTheme";
import { useTurnDiffSummaries } from "../hooks/useTurnDiffSummaries";
import { parseInspectorRouteSearch } from "../inspectorRouteSearch";
import { useGitStatus } from "../lib/gitStatusState";
import { checkpointDiffQueryOptions } from "../lib/providerReactQuery";
import { cn } from "../lib/utils";
import { selectProjectByRef, useStore } from "../store";
import { createThreadSelectorByRef } from "../storeSelectors";
import { buildThreadRouteParams, resolveThreadRouteRef } from "../threadRoutes";
import { formatShortTimestamp } from "../timestampFormat";
import { useInspectorReviewStore } from "../inspectorReviewStore";
import { VscodeEntryIcon } from "./chat/VscodeEntryIcon";
import { buildFileDiffRenderKey, getRenderablePatch, resolveFileDiffPath } from "./diffRenderable";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import { Textarea } from "./ui/textarea";

const REVIEW_CHECKLIST_ITEMS = [
  { id: "correctness", label: "Correctness reviewed" },
  { id: "edge-cases", label: "Edge cases checked" },
  { id: "follow-up", label: "Follow-up required" },
] as const;

interface ReviewPanelProps {
  routeKind: "draft" | "server";
}

function joinWorkspacePath(workspaceRoot: string, relativePath: string): string {
  return workspaceRoot.endsWith("/")
    ? workspaceRoot + relativePath
    : workspaceRoot + "/" + relativePath;
}

export function ReviewPanel({ routeKind }: ReviewPanelProps) {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const routeThreadRef = useParams({
    strict: false,
    select: (params) => resolveThreadRouteRef(params),
  });
  const diffSearch = useSearch({ strict: false, select: (search) => parseDiffRouteSearch(search) });
  const inspectorSearch = useSearch({
    strict: false,
    select: (search) => parseInspectorRouteSearch(search),
  });
  const activeThread = useStore(
    useMemo(() => createThreadSelectorByRef(routeThreadRef), [routeThreadRef]),
  );
  const activeProject = useStore((store) =>
    activeThread
      ? selectProjectByRef(store, {
          environmentId: activeThread.environmentId,
          projectId: activeThread.projectId,
        })
      : undefined,
  );
  const activeCwd = activeThread?.worktreePath ?? activeProject?.cwd ?? null;
  const gitStatusQuery = useGitStatus({
    environmentId: activeThread?.environmentId ?? null,
    cwd: activeCwd,
  });
  const isGitRepo = gitStatusQuery.data?.isRepo ?? true;
  const { turnDiffSummaries, inferredCheckpointTurnCountByTurnId } =
    useTurnDiffSummaries(activeThread);
  const orderedTurnDiffSummaries = useMemo(
    () =>
      [...turnDiffSummaries].toSorted((left, right) => {
        const leftTurnCount =
          left.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[left.turnId] ?? 0;
        const rightTurnCount =
          right.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[right.turnId] ?? 0;
        if (leftTurnCount !== rightTurnCount) {
          return rightTurnCount - leftTurnCount;
        }
        return right.completedAt.localeCompare(left.completedAt);
      }),
    [inferredCheckpointTurnCountByTurnId, turnDiffSummaries],
  );
  const selectedTurnId = diffSearch.diffTurnId ?? null;
  const selectedTurn =
    selectedTurnId === null
      ? undefined
      : (orderedTurnDiffSummaries.find((summary) => summary.turnId === selectedTurnId) ??
        orderedTurnDiffSummaries[0]);
  const selectedCheckpointTurnCount =
    selectedTurn &&
    (selectedTurn.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[selectedTurn.turnId]);
  const selectedCheckpointRange = useMemo(
    () =>
      typeof selectedCheckpointTurnCount === "number"
        ? {
            fromTurnCount: Math.max(0, selectedCheckpointTurnCount - 1),
            toTurnCount: selectedCheckpointTurnCount,
          }
        : null,
    [selectedCheckpointTurnCount],
  );
  const conversationCheckpointTurnCount = useMemo(() => {
    const turnCounts = orderedTurnDiffSummaries
      .map(
        (summary) =>
          summary.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[summary.turnId],
      )
      .filter((value): value is number => typeof value === "number");
    if (turnCounts.length === 0) {
      return undefined;
    }
    const latest = Math.max(...turnCounts);
    return latest > 0 ? latest : undefined;
  }, [inferredCheckpointTurnCountByTurnId, orderedTurnDiffSummaries]);
  const conversationCheckpointRange = useMemo(
    () =>
      !selectedTurn && typeof conversationCheckpointTurnCount === "number"
        ? {
            fromTurnCount: 0,
            toTurnCount: conversationCheckpointTurnCount,
          }
        : null,
    [conversationCheckpointTurnCount, selectedTurn],
  );
  const checkpointRange = selectedCheckpointRange ?? conversationCheckpointRange;
  const checkpointDiffQuery = useQuery(
    checkpointDiffQueryOptions({
      environmentId: activeThread?.environmentId ?? null,
      threadId: activeThread?.id ?? null,
      fromTurnCount: checkpointRange?.fromTurnCount ?? null,
      toTurnCount: checkpointRange?.toTurnCount ?? null,
      cacheScope: "review:" + (selectedTurn?.turnId ?? "all"),
      enabled: routeKind === "server" && orderedTurnDiffSummaries.length > 0,
    }),
  );
  const renderablePatch = useMemo(
    () =>
      getRenderablePatch(
        checkpointDiffQuery.data?.diff,
        "review:" + (selectedTurn?.turnId ?? "all"),
      ),
    [checkpointDiffQuery.data?.diff, selectedTurn?.turnId],
  );
  const renderableFiles = useMemo(
    () =>
      renderablePatch?.kind === "files"
        ? renderablePatch.files.map((file) => ({
            key: buildFileDiffRenderKey(file),
            path: resolveFileDiffPath(file),
          }))
        : [],
    [renderablePatch],
  );
  const effectiveFilePath =
    diffSearch.diffFilePath &&
    renderableFiles.some((entry) => entry.path === diffSearch.diffFilePath)
      ? diffSearch.diffFilePath
      : renderableFiles[0]?.path;
  const reviewState = useInspectorReviewStore((state) =>
    activeThread && effectiveFilePath
      ? state.reviewStateByThreadId[activeThread.id]?.[effectiveFilePath]
      : undefined,
  );
  const setReviewNotes = useInspectorReviewStore((state) => state.setNotes);
  const setReviewChecklistItem = useInspectorReviewStore((state) => state.setChecklistItem);

  const selectTurn = (turnId: TurnId) => {
    if (!routeThreadRef) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(routeThreadRef),
      search: (previous) => ({
        ...stripDiffSearchParams(previous),
        diffTurnId: turnId,
        diffFilePath: undefined,
      }),
    });
  };

  const selectWholeConversation = () => {
    if (!routeThreadRef) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(routeThreadRef),
      search: (previous) => stripDiffSearchParams(previous),
    });
  };

  const selectFile = (filePath: string) => {
    if (!routeThreadRef) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(routeThreadRef),
      search: (previous) => ({
        ...stripDiffSearchParams(previous),
        ...(selectedTurnId ? { diffTurnId: selectedTurnId } : {}),
        diffFilePath: filePath,
      }),
    });
  };

  const openChangesTab = () => {
    if (!routeThreadRef) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(routeThreadRef),
      search: (previous) => ({
        ...previous,
        inspector: inspectorSearch.inspector ?? "1",
        inspectorTab: "changes",
      }),
    });
  };

  const openFileInEditor = async () => {
    if (!activeCwd || !effectiveFilePath) {
      return;
    }
    await openInPreferredEditor(ensureLocalApi(), joinWorkspacePath(activeCwd, effectiveFilePath));
  };

  if (routeKind !== "server") {
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        Review is available after the draft becomes a server thread with completed turns.
      </div>
    );
  }

  if (!activeThread) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        Select a thread to review changes.
      </div>
    );
  }

  if (!isGitRepo) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        Review is unavailable because this project is not a git repository.
      </div>
    );
  }

  if (orderedTurnDiffSummaries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        No completed turns yet.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[color-mix(in_srgb,var(--background)_96%,black)]">
      <div className="border-b border-border/80 px-3 py-2.5">
        <ScrollArea className="w-full">
          <div className="flex gap-1.5">
            <button
              type="button"
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-left text-[12px] font-medium tracking-[-0.01em] transition-all duration-150 ease-out",
                selectedTurnId === null
                  ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  : "bg-card/50 text-muted-foreground hover:bg-accent/45 hover:text-foreground",
              )}
              onClick={selectWholeConversation}
            >
              All turns
            </button>
            {orderedTurnDiffSummaries.map((summary) => (
              <button
                key={summary.turnId}
                type="button"
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-left transition-all duration-150 ease-out",
                  summary.turnId === selectedTurn?.turnId
                    ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--border)_72%,transparent)]"
                    : "bg-card/50 text-muted-foreground hover:bg-accent/45 hover:text-foreground",
                )}
                onClick={() => selectTurn(summary.turnId)}
              >
                <div className="text-[11px] font-medium">
                  Turn{" "}
                  {summary.checkpointTurnCount ??
                    inferredCheckpointTurnCountByTurnId[summary.turnId] ??
                    "?"}
                </div>
                <div className="text-[10px] opacity-70">
                  {formatShortTimestamp(summary.completedAt, "locale")}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 w-80 shrink-0 flex-col border-r border-border/80">
          <div className="flex items-center justify-between border-b border-border/80 px-3 py-3">
            <span className="text-sm font-semibold tracking-[-0.02em] text-foreground">
              Changed files
            </span>
            <Button variant="ghost" size="xs" onClick={openChangesTab}>
              Open raw diff
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 p-2">
              {checkpointDiffQuery.isLoading ? (
                <div className="px-2 py-2 text-xs text-muted-foreground/70">
                  Loading review data...
                </div>
              ) : checkpointDiffQuery.error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {checkpointDiffQuery.error.message}
                </div>
              ) : renderablePatch?.kind !== "files" ? (
                <div className="px-2 py-2 text-xs text-muted-foreground/70">
                  {renderablePatch?.reason ?? "No patch available for this selection."}
                </div>
              ) : (
                renderableFiles.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => selectFile(entry.path)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[14px] tracking-[-0.01em] transition-all duration-150 ease-out",
                      entry.path === effectiveFilePath
                        ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--border)_68%,transparent)]"
                        : "text-foreground/88 hover:bg-accent/40 hover:text-foreground",
                    )}
                  >
                    <VscodeEntryIcon
                      pathValue={entry.path}
                      kind="file"
                      theme={resolvedTheme}
                      className="size-4 shrink-0"
                    />
                    <span className="min-w-0 truncate">{entry.path}</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
                {effectiveFilePath ?? "Changed file"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {selectedTurn
                  ? "Review notes and checklist stay local to this file."
                  : "Select a changed file to capture review notes."}
              </div>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void openFileInEditor()}
              disabled={!effectiveFilePath || !activeCwd}
            >
              <ExternalLinkIcon className="size-3.5" />
              Open
            </Button>
          </div>
          {!effectiveFilePath ? (
            <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
              Select a changed file to capture review notes.
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium tracking-[-0.01em] text-foreground">
                    Review checklist
                  </h3>
                  <div className="space-y-2">
                    {REVIEW_CHECKLIST_ITEMS.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 text-xs text-foreground"
                      >
                        <Checkbox
                          checked={Boolean(reviewState?.checklistById[item.id])}
                          onCheckedChange={(checked) => {
                            setReviewChecklistItem(
                              activeThread.id,
                              effectiveFilePath,
                              item.id,
                              checked === true,
                            );
                          }}
                          aria-label={item.label}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium tracking-[-0.01em] text-foreground">
                    Review notes
                  </h3>
                  <Textarea
                    value={reviewState?.notes ?? ""}
                    onChange={(event) => {
                      setReviewNotes(activeThread.id, effectiveFilePath, event.target.value);
                    }}
                    placeholder="Capture concerns, follow-ups, or acceptance notes for this file."
                    className="min-h-56 rounded-2xl border border-border/70 bg-black/12 px-4 py-3 leading-6 tracking-[-0.01em]"
                    aria-label="Review notes"
                  />
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
