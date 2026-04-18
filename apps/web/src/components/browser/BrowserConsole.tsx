import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  BanIcon,
  GlobeIcon,
  InfoIcon,
  TerminalSquareIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";

import {
  type ConsoleEntry,
  consoleEntryFromMessage,
  formatNetworkDuration,
  formatNetworkStatus,
  getNetworkPathLabel,
  isConsoleBridgeMessage,
  isNetworkBridgeMessage,
  networkEntryFromMessage,
  type NetworkEntry,
} from "./browserBridgeEvents";

type ConsoleFilter = "all" | "error" | "warn" | "info";
type NetworkFilter = "all" | "failed" | "fetch" | "xhr";
type BrowserTab = "console" | "network";

const MAX_ENTRIES = 500;

let entryIdCounter = 0;

function levelIcon(level: ConsoleEntry["level"]) {
  switch (level) {
    case "error":
      return <XCircleIcon className="size-3.5 shrink-0 text-red-500" />;
    case "warn":
      return <AlertTriangleIcon className="size-3.5 shrink-0 text-amber-500" />;
    case "info":
      return <InfoIcon className="size-3.5 shrink-0 text-blue-400" />;
    case "debug":
      return <BanIcon className="size-3.5 shrink-0 text-muted-foreground" />;
    default:
      return null;
  }
}

function levelRowClassName(level: ConsoleEntry["level"]) {
  switch (level) {
    case "error":
      return "bg-red-500/5 border-red-500/20";
    case "warn":
      return "bg-amber-500/5 border-amber-500/20";
    default:
      return "border-border/50";
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function matchesFilter(entry: ConsoleEntry, filter: ConsoleFilter): boolean {
  if (filter === "all") return true;
  if (filter === "error") return entry.level === "error";
  if (filter === "warn") return entry.level === "warn" || entry.level === "error";
  if (filter === "info") return entry.level !== "debug";
  return true;
}

const ConsoleEntryRow = memo(function ConsoleEntryRow({ entry }: { entry: ConsoleEntry }) {
  const message = entry.args.join(" ");

  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b px-2 py-1 font-mono text-xs leading-relaxed",
        levelRowClassName(entry.level),
      )}
    >
      <span className="mt-0.5">{levelIcon(entry.level)}</span>
      <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all text-foreground/80">
        {message}
      </pre>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
        {formatTime(entry.timestamp)}
      </span>
    </div>
  );
});

const FILTER_OPTIONS: { value: ConsoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "error", label: "Errors" },
  { value: "warn", label: "Warnings" },
  { value: "info", label: "Info" },
];

const NETWORK_FILTER_OPTIONS: { value: NetworkFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "failed", label: "Failed" },
  { value: "fetch", label: "Fetch" },
  { value: "xhr", label: "XHR" },
];

function matchesNetworkFilter(entry: NetworkEntry, filter: NetworkFilter): boolean {
  if (filter === "all") return true;
  if (filter === "failed") return !entry.ok;
  return entry.kind === filter;
}

const NetworkEntryRow = memo(function NetworkEntryRow({ entry }: { entry: NetworkEntry }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-start gap-2 border-b px-2 py-1 font-mono text-xs leading-relaxed",
        entry.ok ? "border-border/50" : "bg-red-500/5 border-red-500/20",
      )}
    >
      <span
        className={cn(
          "mt-0.5 rounded px-1 py-0.5 text-[10px] font-semibold",
          entry.kind === "fetch"
            ? "bg-blue-500/10 text-blue-400"
            : "bg-emerald-500/10 text-emerald-400",
        )}
      >
        {entry.method}
      </span>
      <div className="min-w-0">
        <div className="truncate text-foreground/80">{getNetworkPathLabel(entry.url)}</div>
        {entry.errorMessage ? (
          <div className="truncate text-[10px] text-red-400/90">{entry.errorMessage}</div>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          entry.ok ? "text-muted-foreground/70" : "text-red-400",
        )}
      >
        {formatNetworkStatus(entry)}
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
        {formatNetworkDuration(entry.durationMs)}
      </span>
    </div>
  );
});

export function BrowserConsole(props: { className?: string }) {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [networkEntries, setNetworkEntries] = useState<NetworkEntry[]>([]);
  const [activeTab, setActiveTab] = useState<BrowserTab>("console");
  const [filter, setFilter] = useState<ConsoleFilter>("all");
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (isConsoleBridgeMessage(event.data)) {
        const newEntry = consoleEntryFromMessage(event.data, entryIdCounter++);
        setEntries((previous) => {
          const next = [...previous, newEntry];
          if (next.length > MAX_ENTRIES) {
            return next.slice(next.length - MAX_ENTRIES);
          }
          return next;
        });
        return;
      }
      if (!isNetworkBridgeMessage(event.data)) return;
      const newEntry = networkEntryFromMessage(event.data, entryIdCounter++);
      setNetworkEntries((previous) => {
        const next = [...previous, newEntry];
        if (next.length > MAX_ENTRIES) {
          return next.slice(next.length - MAX_ENTRIES);
        }
        return next;
      });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || isUserScrolledUp.current) return;
    container.scrollTop = container.scrollHeight;
  }, [activeTab, entries.length, networkEntries.length, filter, networkFilter]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isUserScrolledUp.current = distanceFromBottom > 40;
  }, []);

  const clearEntries = useCallback(() => {
    if (activeTab === "console") {
      setEntries([]);
    } else {
      setNetworkEntries([]);
    }
    isUserScrolledUp.current = false;
  }, [activeTab]);

  const filteredEntries =
    filter === "all" ? entries : entries.filter((entry) => matchesFilter(entry, filter));
  const filteredNetworkEntries =
    networkFilter === "all"
      ? networkEntries
      : networkEntries.filter((entry) => matchesNetworkFilter(entry, networkFilter));
  const errorCount = entries.filter((entry) => entry.level === "error").length;
  const warnCount = entries.filter((entry) => entry.level === "warn").length;
  const failedRequestCount = networkEntries.filter((entry) => !entry.ok).length;
  const visibleEntryCount =
    activeTab === "console" ? filteredEntries.length : filteredNetworkEntries.length;
  const isConsoleTab = activeTab === "console";

  return (
    <div className={cn("flex flex-col border-t border-border bg-card/50", props.className)}>
      <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1">
        <button
          type="button"
          onClick={() => setActiveTab("console")}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
            isConsoleTab
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <TerminalSquareIcon className="size-3" />
          <span>Console</span>
          {errorCount > 0 ? (
            <span className="rounded-full bg-red-500/15 px-1.5 text-[10px] font-medium tabular-nums text-red-500">
              {errorCount}
            </span>
          ) : warnCount > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-medium tabular-nums text-amber-500">
              {warnCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("network")}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
            !isConsoleTab
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <GlobeIcon className="size-3" />
          <span>Network</span>
          {failedRequestCount > 0 ? (
            <span className="rounded-full bg-red-500/15 px-1.5 text-[10px] font-medium tabular-nums text-red-500">
              {failedRequestCount}
            </span>
          ) : networkEntries.length > 0 ? (
            <span className="rounded-full bg-accent px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {networkEntries.length}
            </span>
          ) : null}
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          {isConsoleTab
            ? FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    filter === option.value
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))
            : NETWORK_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setNetworkFilter(option.value)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    networkFilter === option.value
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
        </div>
        <button
          type="button"
          onClick={clearEntries}
          className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={isConsoleTab ? "Clear console" : "Clear network log"}
        >
          <Trash2Icon className="size-3" />
        </button>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
        {visibleEntryCount === 0 ? (
          <div className="flex h-full items-center justify-center py-6 text-xs text-muted-foreground/50">
            {isConsoleTab
              ? entries.length === 0
                ? "No console output yet. Add the console bridge script to your app."
                : "No matching console entries."
              : networkEntries.length === 0
                ? "No network activity yet. Add the console bridge script to your app."
                : "No matching network entries."}
          </div>
        ) : isConsoleTab ? (
          filteredEntries.map((entry) => <ConsoleEntryRow key={entry.id} entry={entry} />)
        ) : (
          filteredNetworkEntries.map((entry) => <NetworkEntryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
