import { createFileRoute, retainSearchParams, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";

import ChatView from "../components/ChatView";
import { InspectorPanel } from "../components/InspectorPanel";
import { RightPanelInlineSidebar } from "../components/RightPanelInlineSidebar";
import { RightPanelSheet } from "../components/RightPanelSheet";
import { SidebarInset } from "../components/ui/sidebar";
import { DraftId, useComposerDraftStore } from "../composerDraftStore";
import { type InspectorRouteSearch, parseInspectorRouteSearch } from "../inspectorRouteSearch";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "../rightPanelLayout";
import { useStore } from "../store";
import { createThreadSelectorAcrossEnvironments } from "../storeSelectors";
import { buildThreadRouteParams } from "../threadRoutes";
import { threadHasStarted } from "../components/ChatView.logic";

const INSPECTOR_INLINE_SIDEBAR_WIDTH_STORAGE_KEY = "chat_inspector_sidebar_width";

function DraftChatThreadRouteView() {
  const navigate = useNavigate();
  const { draftId: rawDraftId } = Route.useParams();
  const search = Route.useSearch();
  const draftId = DraftId.make(rawDraftId);
  const draftSession = useComposerDraftStore((store) => store.getDraftSession(draftId));
  const serverThread = useStore(
    useMemo(
      () => createThreadSelectorAcrossEnvironments(draftSession?.threadId ?? null),
      [draftSession?.threadId],
    ),
  );
  const serverThreadStarted = threadHasStarted(serverThread);
  const canonicalThreadRef = useMemo(
    () =>
      draftSession?.promotedTo
        ? serverThreadStarted
          ? draftSession.promotedTo
          : null
        : serverThread
          ? {
              environmentId: serverThread.environmentId,
              threadId: serverThread.id,
            }
          : null,
    [draftSession?.promotedTo, serverThread, serverThreadStarted],
  );
  const inspectorOpen = search.inspector === "1";
  const shouldUseRightPanelSheet = useMediaQuery(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);

  const closeInspector = useCallback(() => {
    void navigate({
      to: "/draft/$draftId",
      params: { draftId },
      search: (previous) => ({
        ...previous,
        inspector: undefined,
      }),
    });
  }, [draftId, navigate]);

  const openInspector = useCallback(() => {
    void navigate({
      to: "/draft/$draftId",
      params: { draftId },
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
  }, [draftId, navigate]);

  const selectInspectorTab = useCallback(
    (tab: "preview" | "review" | "changes" | "files") => {
      void navigate({
        to: "/draft/$draftId",
        params: { draftId },
        search: (previous) => ({
          ...previous,
          inspector: "1",
          inspectorTab: tab,
        }),
      });
    },
    [draftId, navigate],
  );

  useEffect(() => {
    if (!canonicalThreadRef) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(canonicalThreadRef),
      replace: true,
      search: (previous) => previous,
    });
  }, [canonicalThreadRef, navigate]);

  useEffect(() => {
    if (draftSession || canonicalThreadRef) {
      return;
    }
    void navigate({ to: "/", replace: true });
  }, [canonicalThreadRef, draftSession, navigate]);

  if (canonicalThreadRef) {
    return (
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView
          environmentId={canonicalThreadRef.environmentId}
          threadId={canonicalThreadRef.threadId}
          reserveTitleBarControlInset={!inspectorOpen}
          routeKind="server"
        />
      </SidebarInset>
    );
  }

  if (!draftSession) {
    return null;
  }

  const inspector = (
    <InspectorPanel
      environmentId={draftSession.environmentId}
      mode={shouldUseRightPanelSheet ? "sheet" : "sidebar"}
      onClose={closeInspector}
      onSelectTab={selectInspectorTab}
      routeKind="draft"
      threadId={draftSession.threadId}
      workspaceRoot={draftSession.worktreePath}
    />
  );

  if (!shouldUseRightPanelSheet) {
    return (
      <>
        <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
          <ChatView
            draftId={draftId}
            environmentId={draftSession.environmentId}
            threadId={draftSession.threadId}
            reserveTitleBarControlInset={!inspectorOpen}
            routeKind="draft"
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
          draftId={draftId}
          environmentId={draftSession.environmentId}
          threadId={draftSession.threadId}
          routeKind="draft"
        />
      </SidebarInset>
      <RightPanelSheet open={inspectorOpen} onClose={closeInspector}>
        {inspector}
      </RightPanelSheet>
    </>
  );
}

export const Route = createFileRoute("/_chat/draft/$draftId")({
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
  component: DraftChatThreadRouteView,
});
