import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  BanIcon,
  InfoIcon,
  TerminalSquareIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";

export interface ConsoleEntry {
  id: number;
  level: "log" | "info" | "warn" | "error" | "debug";
  args: string[];
  timestamp: number;
  url?: string;
}

type ConsoleFilter = "all" | "error" | "warn" | "info";

const MAX_ENTRIES = 500;
const CONSOLE_BRIDGE_SOURCE = "nuecode-console-bridge";

let entryIdCounter = 0;

interface ConsoleBridgeMessage {
  source: typeof CONSOLE_BRIDGE_SOURCE;
  type: "console" | "error";
  level: ConsoleEntry["level"];
  args: string[];
  timestamp: number;
  url?: string;
}

function isConsoleBridgeMessage(data: unknown): data is ConsoleBridgeMessage {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    record.source === CONSOLE_BRIDGE_SOURCE &&
    (record.type === "console" || record.type === "error")
  );
}

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

export function BrowserConsole(props: { className?: string }) {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [filter, setFilter] = useState<ConsoleFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isConsoleBridgeMessage(event.data)) return;

      const newEntry: ConsoleEntry = {
        id: entryIdCounter++,
        level: event.data.level,
        args: event.data.args,
        timestamp: event.data.timestamp,
        ...(event.data.url ? { url: event.data.url } : {}),
      };

      setEntries((previous) => {
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
  }, [entries]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isUserScrolledUp.current = distanceFromBottom > 40;
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    isUserScrolledUp.current = false;
  }, []);

  const filteredEntries =
    filter === "all" ? entries : entries.filter((entry) => matchesFilter(entry, filter));
  const errorCount = entries.filter((entry) => entry.level === "error").length;
  const warnCount = entries.filter((entry) => entry.level === "warn").length;

  return (
    <div className={cn("flex flex-col border-t border-border bg-card/50", props.className)}>
      <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1">
        <TerminalSquareIcon className="size-3 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground">Console</span>
        {errorCount > 0 && (
          <span className="rounded-full bg-red-500/15 px-1.5 text-[10px] font-medium tabular-nums text-red-500">
            {errorCount}
          </span>
        )}
        {warnCount > 0 && (
          <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-medium tabular-nums text-amber-500">
            {warnCount}
          </span>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          {FILTER_OPTIONS.map((option) => (
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
          ))}
        </div>
        <button
          type="button"
          onClick={clearEntries}
          className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear console"
        >
          <Trash2Icon className="size-3" />
        </button>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="flex h-full items-center justify-center py-6 text-xs text-muted-foreground/50">
            {entries.length === 0
              ? "No console output yet. Add the console bridge script to your app."
              : "No matching entries."}
          </div>
        ) : (
          filteredEntries.map((entry) => <ConsoleEntryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
