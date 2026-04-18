import { TurnId } from "@t3tools/contracts";

export type InspectorTab = "preview" | "review" | "changes" | "files";

export interface InspectorRouteSearch {
  inspector?: "1" | undefined;
  inspectorTab?: InspectorTab | undefined;
  browserUrl?: string | undefined;
  diffTurnId?: TurnId | undefined;
  diffFilePath?: string | undefined;
  filePath?: string | undefined;
}

const INSPECTOR_TABS = new Set<InspectorTab>(["preview", "review", "changes", "files"]);

function isInspectorOpenValue(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

function normalizeSearchString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeInspectorTab(value: unknown): InspectorTab | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return INSPECTOR_TABS.has(value as InspectorTab) ? (value as InspectorTab) : undefined;
}

export function stripInspectorSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<
  T,
  | "inspector"
  | "inspectorTab"
  | "browser"
  | "browserUrl"
  | "diff"
  | "diffTurnId"
  | "diffFilePath"
  | "filePath"
> {
  const {
    inspector: _inspector,
    inspectorTab: _inspectorTab,
    browser: _browser,
    browserUrl: _browserUrl,
    diff: _diff,
    diffTurnId: _diffTurnId,
    diffFilePath: _diffFilePath,
    filePath: _filePath,
    ...rest
  } = params;
  return rest as Omit<
    T,
    | "inspector"
    | "inspectorTab"
    | "browser"
    | "browserUrl"
    | "diff"
    | "diffTurnId"
    | "diffFilePath"
    | "filePath"
  >;
}

export function parseInspectorRouteSearch(search: Record<string, unknown>): InspectorRouteSearch {
  const explicitOpen = isInspectorOpenValue(search.inspector);
  const explicitTab = normalizeInspectorTab(search.inspectorTab);
  const legacyTab =
    search.diff === "1" || search.diff === 1 || search.diff === true
      ? "changes"
      : search.browser === "1" || search.browser === 1 || search.browser === true
        ? "preview"
        : undefined;
  const inspector = explicitOpen || legacyTab ? "1" : undefined;
  const inspectorTab = explicitTab ?? legacyTab ?? (explicitOpen ? "preview" : undefined);
  const browserUrl = normalizeSearchString(search.browserUrl);
  const diffTurnIdRaw = normalizeSearchString(search.diffTurnId);
  const diffTurnId = diffTurnIdRaw ? TurnId.make(diffTurnIdRaw) : undefined;
  const diffFilePath = diffTurnId ? normalizeSearchString(search.diffFilePath) : undefined;
  const filePath = normalizeSearchString(search.filePath);

  return {
    ...(inspector ? { inspector } : {}),
    ...(inspectorTab ? { inspectorTab } : {}),
    ...(browserUrl ? { browserUrl } : {}),
    ...(diffTurnId ? { diffTurnId } : {}),
    ...(diffFilePath ? { diffFilePath } : {}),
    ...(filePath ? { filePath } : {}),
  };
}
