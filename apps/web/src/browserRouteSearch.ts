export interface BrowserRouteSearch {
  browser?: "1" | undefined;
  browserUrl?: string | undefined;
}

function isBrowserOpenValue(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

function normalizeSearchString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function stripBrowserSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "browser" | "browserUrl"> {
  const { browser: _browser, browserUrl: _browserUrl, ...rest } = params;
  return rest as Omit<T, "browser" | "browserUrl">;
}

export function parseBrowserRouteSearch(search: Record<string, unknown>): BrowserRouteSearch {
  const browser = isBrowserOpenValue(search.browser) ? "1" : undefined;
  const browserUrl = browser ? normalizeSearchString(search.browserUrl) : undefined;

  return {
    ...(browser ? { browser } : {}),
    ...(browserUrl ? { browserUrl } : {}),
  };
}
