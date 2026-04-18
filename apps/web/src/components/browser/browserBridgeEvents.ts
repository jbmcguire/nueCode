export const CONSOLE_BRIDGE_SOURCE = "nuecode-console-bridge";

export interface ConsoleEntry {
  id: number;
  level: "log" | "info" | "warn" | "error" | "debug";
  args: string[];
  timestamp: number;
  url?: string;
}

export interface NetworkEntry {
  id: number;
  requestId: string;
  kind: "fetch" | "xhr";
  method: string;
  url: string;
  timestamp: number;
  ok: boolean;
  statusCode: number | null;
  statusText?: string;
  durationMs?: number;
  errorMessage?: string;
}

export interface ConsoleBridgeMessage {
  source: typeof CONSOLE_BRIDGE_SOURCE;
  type: "console" | "error";
  level: ConsoleEntry["level"];
  args: string[];
  timestamp: number;
  url?: string;
}

export interface NetworkBridgeMessage {
  source: typeof CONSOLE_BRIDGE_SOURCE;
  type: "network";
  requestId: string;
  kind: NetworkEntry["kind"];
  method: string;
  url: string;
  timestamp: number;
  ok: boolean;
  statusCode?: number;
  statusText?: string;
  durationMs?: number;
  errorMessage?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConsoleLevel(value: unknown): value is ConsoleEntry["level"] {
  return (
    value === "log" ||
    value === "info" ||
    value === "warn" ||
    value === "error" ||
    value === "debug"
  );
}

export function isConsoleBridgeMessage(data: unknown): data is ConsoleBridgeMessage {
  if (!isRecord(data)) return false;
  if (data.source !== CONSOLE_BRIDGE_SOURCE) return false;
  if (data.type !== "console" && data.type !== "error") return false;
  if (!isConsoleLevel(data.level)) return false;
  return Array.isArray(data.args);
}

export function isNetworkBridgeMessage(data: unknown): data is NetworkBridgeMessage {
  if (!isRecord(data)) return false;
  if (data.source !== CONSOLE_BRIDGE_SOURCE) return false;
  if (data.type !== "network") return false;
  if (data.kind !== "fetch" && data.kind !== "xhr") return false;
  if (typeof data.requestId !== "string" || data.requestId.length === 0) return false;
  if (typeof data.method !== "string" || data.method.length === 0) return false;
  if (typeof data.url !== "string" || data.url.length === 0) return false;
  return typeof data.ok === "boolean";
}

export function consoleEntryFromMessage(message: ConsoleBridgeMessage, id: number): ConsoleEntry {
  return {
    id,
    level: message.level,
    args: message.args,
    timestamp: message.timestamp,
    ...(message.url ? { url: message.url } : {}),
  };
}

export function networkEntryFromMessage(message: NetworkBridgeMessage, id: number): NetworkEntry {
  return {
    id,
    requestId: message.requestId,
    kind: message.kind,
    method: message.method.toUpperCase(),
    url: message.url,
    timestamp: message.timestamp,
    ok: message.ok,
    statusCode: typeof message.statusCode === "number" ? message.statusCode : null,
    ...(message.statusText ? { statusText: message.statusText } : {}),
    ...(typeof message.durationMs === "number" ? { durationMs: message.durationMs } : {}),
    ...(message.errorMessage ? { errorMessage: message.errorMessage } : {}),
  };
}

export function formatNetworkDuration(durationMs?: number): string {
  if (typeof durationMs !== "number" || Number.isNaN(durationMs)) return "—";
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
}

export function formatNetworkStatus(
  entry: Pick<NetworkEntry, "ok" | "statusCode" | "errorMessage">,
): string {
  if (!entry.ok && entry.errorMessage) {
    return entry.errorMessage;
  }
  if (typeof entry.statusCode === "number") {
    return String(entry.statusCode);
  }
  return entry.ok ? "OK" : "Failed";
}

export function getNetworkPathLabel(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
  } catch {
    return url;
  }
}
