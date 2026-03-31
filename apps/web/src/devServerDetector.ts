const LOCALHOST_URL_PATTERN =
  /https?:\/\/(?:localhost|127\.0\.0\.1)(?::(\d{1,5}))(?:\/[^\s"'`<>]*)?/g;

const DEV_SERVER_CONTEXT_PATTERNS = [
  /Local:\s*(https?:\/\/[^\s]+)/,
  /ready\s.*started\sserver\son\s.*:(\d+)/i,
  /listening\s(?:on|at)\s*(https?:\/\/[^\s]+)/i,
  /server\s(?:running|started)\s(?:on|at)\s*(https?:\/\/[^\s]+)/i,
  /Network:\s*(https?:\/\/[^\s]+)/,
  /App\s(?:running|available)\s(?:on|at)\s*(https?:\/\/[^\s]+)/i,
  /➜\s+Local:\s*(https?:\/\/[^\s]+)/,
];

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[.,;!?]+$/, "");
}

export function extractLocalhostUrl(text: string): string | null {
  for (const pattern of DEV_SERVER_CONTEXT_PATTERNS) {
    const contextMatch = text.match(pattern);
    if (!contextMatch) continue;

    const captured = contextMatch[1];
    if (captured && /^https?:\/\//.test(captured)) {
      return trimTrailingPunctuation(captured);
    }

    if (captured && /^\d+$/.test(captured)) {
      return `http://localhost:${captured}`;
    }
  }

  LOCALHOST_URL_PATTERN.lastIndex = 0;
  const directMatch = LOCALHOST_URL_PATTERN.exec(text);
  if (directMatch) {
    return trimTrailingPunctuation(directMatch[0]);
  }

  return null;
}
