import {
  memo,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeIcon,
  LoaderIcon,
  RotateCwIcon,
  TerminalSquareIcon,
  XIcon,
} from "lucide-react";
import { useSearch } from "@tanstack/react-router";
import { cn } from "~/lib/utils";

import { useBrowserPanelStore } from "../browserPanelStore";
import { parseInspectorRouteSearch } from "../inspectorRouteSearch";
import { BrowserConsole } from "./browser/BrowserConsole";
import {
  BrowserPanelShell,
  type BrowserPanelMode,
  BrowserPanelHeaderSkeleton,
  BrowserPanelLoadingState,
} from "./BrowserPanelShell";

const CONSOLE_BRIDGE_SOURCE = "nuecode-console-bridge";

interface BrowserState {
  currentUrl: string;
  displayUrl: string;
  historyStack: string[];
  forwardStack: string[];
  isLoading: boolean;
  consoleOpen: boolean;
  hasConsoleErrors: boolean;
}

type BrowserAction =
  | { type: "navigate"; url: string }
  | { type: "go_back" }
  | { type: "go_forward" }
  | { type: "refresh" }
  | { type: "set_display_url"; url: string }
  | { type: "set_loading"; isLoading: boolean }
  | { type: "toggle_console" }
  | { type: "set_console_error"; hasErrors: boolean }
  | { type: "sync_url"; url: string };

function browserReducer(state: BrowserState, action: BrowserAction): BrowserState {
  switch (action.type) {
    case "navigate": {
      if (action.url === state.currentUrl) return state;
      return {
        ...state,
        historyStack: state.currentUrl
          ? [...state.historyStack, state.currentUrl]
          : state.historyStack,
        forwardStack: [],
        currentUrl: action.url,
        displayUrl: action.url,
        isLoading: true,
      };
    }
    case "go_back": {
      if (state.historyStack.length === 0) return state;
      const previousUrl = state.historyStack[state.historyStack.length - 1]!;
      return {
        ...state,
        historyStack: state.historyStack.slice(0, -1),
        forwardStack: [state.currentUrl, ...state.forwardStack],
        currentUrl: previousUrl,
        displayUrl: previousUrl,
        isLoading: true,
      };
    }
    case "go_forward": {
      if (state.forwardStack.length === 0) return state;
      const nextUrl = state.forwardStack[0]!;
      return {
        ...state,
        historyStack: [...state.historyStack, state.currentUrl],
        forwardStack: state.forwardStack.slice(1),
        currentUrl: nextUrl,
        displayUrl: nextUrl,
        isLoading: true,
      };
    }
    case "refresh": {
      return { ...state, isLoading: true };
    }
    case "set_display_url": {
      return { ...state, displayUrl: action.url };
    }
    case "set_loading": {
      return { ...state, isLoading: action.isLoading };
    }
    case "toggle_console": {
      return { ...state, consoleOpen: !state.consoleOpen };
    }
    case "set_console_error": {
      return { ...state, hasConsoleErrors: action.hasErrors };
    }
    case "sync_url": {
      if (action.url === state.currentUrl) return state;
      return {
        ...state,
        historyStack: state.currentUrl
          ? [...state.historyStack, state.currentUrl]
          : state.historyStack,
        forwardStack: [],
        currentUrl: action.url,
        displayUrl: action.url,
      };
    }
  }
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  if (/^localhost(:\d+)?/i.test(trimmed)) return `http://${trimmed}`;

  if (/^\d+$/.test(trimmed)) return `http://localhost:${trimmed}`;

  if (/^:\d+/.test(trimmed)) return `http://localhost${trimmed}`;

  return `http://${trimmed}`;
}

interface BrowserPanelProps {
  embedded?: boolean;
  mode: BrowserPanelMode;
  threadId: string;
  onClose: () => void;
}

function BrowserPanelComponent({ embedded = false, mode, threadId, onClose }: BrowserPanelProps) {
  const routeSearch = useSearch({
    strict: false,
    select: (search) => parseInspectorRouteSearch(search),
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const storeUrl = useBrowserPanelStore((state) => state.getUrl(threadId));
  const setStoreUrl = useBrowserPanelStore((state) => state.setUrl);
  const routeUrl = routeSearch.browserUrl;
  const initialUrl = routeUrl ?? storeUrl ?? "";

  const [state, dispatch] = useReducer(browserReducer, {
    currentUrl: initialUrl,
    displayUrl: initialUrl,
    historyStack: [],
    forwardStack: [],
    isLoading: initialUrl.length > 0,
    consoleOpen: false,
    hasConsoleErrors: false,
  });

  // Sync store URL into state when it changes externally (e.g. auto-detection)
  useEffect(() => {
    if (storeUrl && storeUrl !== state.currentUrl && state.currentUrl === "") {
      dispatch({ type: "navigate", url: storeUrl });
    }
  }, [storeUrl, state.currentUrl]);

  useEffect(() => {
    if (routeUrl && routeUrl !== state.currentUrl && state.currentUrl === "") {
      dispatch({ type: "navigate", url: routeUrl });
    }
  }, [routeUrl, state.currentUrl]);

  // Listen for console error messages to show indicator
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (typeof event.data !== "object" || event.data === null) return;
      if (event.data.source !== CONSOLE_BRIDGE_SOURCE) return;
      if (
        event.data.level === "error" ||
        (event.data.type === "network" &&
          typeof event.data.ok === "boolean" &&
          event.data.ok === false)
      ) {
        dispatch({ type: "set_console_error", hasErrors: true });
      }
      if (event.data.type === "navigation" && typeof event.data.url === "string") {
        dispatch({ type: "sync_url", url: event.data.url });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleNavigate = useCallback(
    (url: string) => {
      const normalized = normalizeUrl(url);
      if (normalized.length === 0) return;
      dispatch({ type: "navigate", url: normalized });
      setStoreUrl(threadId, normalized);
    },
    [threadId, setStoreUrl],
  );

  const handleUrlSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleNavigate(state.displayUrl);
      urlInputRef.current?.blur();
    },
    [state.displayUrl, handleNavigate],
  );

  const handleUrlKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      urlInputRef.current?.blur();
    }
  }, []);

  const handleGoBack = useCallback(() => dispatch({ type: "go_back" }), []);
  const handleGoForward = useCallback(() => dispatch({ type: "go_forward" }), []);

  const handleRefresh = useCallback(() => {
    dispatch({ type: "refresh" });
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Force reload by briefly clearing src
    const currentSrc = iframe.src;
    iframe.src = "about:blank";
    requestAnimationFrame(() => {
      iframe.src = currentSrc;
    });
  }, []);

  const handleIframeLoad = useCallback(() => {
    dispatch({ type: "set_loading", isLoading: false });

    // Try to read the iframe URL (same-origin only)
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      const iframeUrl = iframe.contentWindow.location.href;
      if (iframeUrl && iframeUrl !== "about:blank") {
        dispatch({ type: "set_display_url", url: iframeUrl });
      }
    } catch {
      // Cross-origin: can't read location, displayUrl stays as-is
    }
  }, []);

  const toolbar = (
    <>
      <button
        type="button"
        onClick={handleGoBack}
        disabled={state.historyStack.length === 0}
        className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        aria-label="Go back"
      >
        <ChevronLeftIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={handleGoForward}
        disabled={state.forwardStack.length === 0}
        className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        aria-label="Go forward"
      >
        <ChevronRightIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={state.currentUrl.length === 0}
        className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        aria-label="Refresh"
      >
        <RotateCwIcon className={cn("size-3.5", state.isLoading && "animate-spin")} />
      </button>

      <form onSubmit={handleUrlSubmit} className="flex min-w-0 flex-1">
        <div className="relative flex min-w-0 flex-1 items-center">
          <GlobeIcon className="pointer-events-none absolute left-2 size-3 text-muted-foreground/50" />
          <input
            ref={urlInputRef}
            type="text"
            value={state.displayUrl}
            onChange={(event) => dispatch({ type: "set_display_url", url: event.target.value })}
            onKeyDown={handleUrlKeyDown}
            placeholder="localhost:3000"
            className="h-7 w-full min-w-0 rounded-md border border-border/60 bg-card/50 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-border focus:outline-none"
            aria-label="URL"
          />
        </div>
      </form>

      <button
        type="button"
        onClick={() => dispatch({ type: "toggle_console" })}
        className={cn(
          "relative rounded p-1 transition-colors",
          state.consoleOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="Toggle browser devtools"
      >
        <TerminalSquareIcon className="size-3.5" />
        {state.hasConsoleErrors && !state.consoleOpen && (
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-red-500" />
        )}
      </button>
      {!embedded ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close browser panel"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </>
  );

  const content = (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {state.currentUrl.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <GlobeIcon className="size-10 text-muted-foreground/20" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground/60">No URL loaded</p>
            <p className="text-xs text-muted-foreground/40">
              Enter a URL above or start a dev server in the terminal.
            </p>
          </div>
        </div>
      ) : (
        <>
          <iframe
            ref={iframeRef}
            src={state.currentUrl}
            onLoad={handleIframeLoad}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            className="min-h-0 flex-1 border-none bg-white"
            title="Browser preview"
          />
          {state.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}
      {state.consoleOpen && <BrowserConsole className="h-48 shrink-0" />}
    </div>
  );

  if (embedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border">
          <div className="flex items-center gap-1.5 px-2 py-2">{toolbar}</div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <BrowserPanelShell mode={mode} header={toolbar}>
      {content}
    </BrowserPanelShell>
  );
}

export const BrowserPanel = memo(BrowserPanelComponent);
export default BrowserPanel;
export { BrowserPanelHeaderSkeleton, BrowserPanelLoadingState };
