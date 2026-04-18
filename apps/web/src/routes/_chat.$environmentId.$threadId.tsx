import { createFileRoute, retainSearchParams, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";

import ChatView from "../components/ChatView";
import { InspectorPanel } from "../components/InspectorPanel";
import { RightPanelInlineSidebar } from "../components/RightPanelInlineSidebar";
import { RightPanelSheet } from "../components/RightPanelSheet";
import { SidebarInset } from "../components/ui/sidebar";
import { finalizePromotedDraftThreadByRef, useComposerDraftStore } from "../composerDraftStore";
import { type InspectorRouteSearch, parseInspectorRouteSearch } from "../inspectorRouteSearch";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "../rightPanelLayout";
import {
  selectEnvironmentState,
  selectProjectByRef,
  selectThreadExistsByRef,
  useStore,
} from "../store";
import { createThreadSelectorByRef } from "../storeSelectors";
import { buildThreadRouteParams, resolveThreadRouteRef } from "../threadRoutes";
import { threadHasStarted } from "../components/ChatView.logic";

const INSPECTOR_INLINE_SIDEBAR_WIDTH_STORAGE_KEY = "chat_inspector_sidebar_width";

function ChatThreadRouteView() {
  const navigate = useNavigate();
  const threadRef = Route.useParams({
    select: (params) => resolveThreadRouteRef(params),
  });
  const search = Route.useSearch();
  const bootstrapComplete = useStore(
    (store) => selectEnvironmentState(store, threadRef?.environmentId ?? null).bootstrapComplete,
  );
  const serverThread = useStore(useMemo(() => createThreadSelectorByRef(threadRef), [threadRef]));
  const activeProject = useStore((store) =>
    serverThread
      ? selectProjectByRef(store, {
          environmentId: serverThread.environmentId,
          projectId: serverThread.projectId,
        })
      : undefined,
  );
  const threadExists = useStore((store) => selectThreadExistsByRef(store, threadRef));
  const environmentHasServerThreads = useStore(
    (store) => selectEnvironmentState(store, threadRef?.environmentId ?? null).threadIds.length > 0,
  );
  const draftThreadExists = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) !== null : false,
  );
  const draftThread = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) : null,
  );
  const environmentHasDraftThreads = useComposerDraftStore((store) => {
    if (!threadRef) {
      return false;
    }
    return store.hasDraftThreadsInEnvironment(threadRef.environmentId);
  });
  const routeThreadExists = threadExists || draftThreadExists;
  const serverThreadStarted = threadHasStarted(serverThread);
  const environmentHasAnyThreads = environmentHasServerThreads || environmentHasDraftThreads;
  const inspectorOpen = search.inspector === "1";
  const shouldUseRightPanelSheet = useMediaQuery(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);
  const workspaceRoot = serverThread?.worktreePath ?? activeProject?.cwd ?? null;

  const closeInspector = useCallback(() => {
    if (!threadRef) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: (previous) => ({
        ...previous,
        inspector: undefined,
      }),
    });
  }, [navigate, threadRef]);

  const openInspector = useCallback(() => {
    if (!threadRef) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: (previous) => ({
        ...previous,
        inspector: "1",
        inspectorTab:
          previous.inspectorTab === "preview" ||
          previous.inspectorTab === "review" ||
          previous.inspectorTab === "changes" ||
          previous.inspectorTab === "files"
            ? previous.inspectorTab
            : "preview",
      }),
    });
  }, [navigate, threadRef]);

  const selectInspectorTab = useCallback(
    (tab: "preview" | "review" | "changes" | "files") => {
      if (!threadRef) {
        return;
      }
      void navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(threadRef),
        search: (previous) => ({
          ...previous,
          inspector: "1",
          inspectorTab: tab,
        }),
      });
    },
    [navigate, threadRef],
  );

  useEffect(() => {
    if (!threadRef || !bootstrapComplete) {
      return;
    }

    if (!routeThreadExists && environmentHasAnyThreads) {
      void navigate({ to: "/", replace: true });
    }
  }, [bootstrapComplete, environmentHasAnyThreads, navigate, routeThreadExists, threadRef]);

  useEffect(() => {
    if (!threadRef || !serverThreadStarted || !draftThread?.promotedTo) {
      return;
    }
    finalizePromotedDraftThreadByRef(threadRef);
  }, [draftThread?.promotedTo, serverThreadStarted, threadRef]);

  if (!threadRef || !bootstrapComplete || !routeThreadExists) {
    return null;
  }

  const inspector = (
    <InspectorPanel
      environmentId={threadRef.environmentId}
      mode={shouldUseRightPanelSheet ? "sheet" : "sidebar"}
      onClose={closeInspector}
      onSelectTab={selectInspectorTab}
      routeKind="server"
      threadId={threadRef.threadId}
      workspaceRoot={workspaceRoot}
    />
  );

  if (!shouldUseRightPanelSheet) {
    return (
      <>
        <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
          <ChatView
            environmentId={threadRef.environmentId}
            threadId={threadRef.threadId}
            reserveTitleBarControlInset={!inspectorOpen}
            routeKind="server"
          />
        </SidebarInset>
        {inspectorOpen ? (
          <RightPanelInlineSidebar
            open={inspectorOpen}
            onClose={closeInspector}
            onOpen={openInspector}
            storageKey={INSPECTOR_INLINE_SIDEBAR_WIDTH_STORAGE_KEY}
          >
            {inspector}
          </RightPanelInlineSidebar>
        ) : null}
      </>
    );
  }

  return (
    <>
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView
          environmentId={threadRef.environmentId}
          threadId={threadRef.threadId}
          routeKind="server"
        />
      </SidebarInset>
      <RightPanelSheet open={inspectorOpen} onClose={closeInspector}>
        {inspector}
      </RightPanelSheet>
    </>
  );
}

export const Route = createFileRoute("/_chat/$environmentId/$threadId")({
  validateSearch: (search): InspectorRouteSearch => parseInspectorRouteSearch(search),
  search: {
    middlewares: [
      retainSearchParams<InspectorRouteSearch>([
        "inspector",
        "inspectorTab",
        "browserUrl",
        "diffTurnId",
        "diffFilePath",
        "filePath",
      ]),
    ],
  },
  component: ChatThreadRouteView,
});
