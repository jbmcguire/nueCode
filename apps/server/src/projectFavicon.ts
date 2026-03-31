import fs from "node:fs";
import path from "node:path";

export const FALLBACK_PROJECT_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#6b728080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-fallback="project-favicon"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/></svg>`;
export const PROJECT_FAVICON_CACHE_CONTROL = "public, max-age=3600";

// Well-known favicon paths checked in order.
const FAVICON_CANDIDATES = [
  "favicon.svg",
  "favicon.ico",
  "favicon.png",
  "public/favicon.svg",
  "public/favicon.ico",
  "public/favicon.png",
  "app/favicon.ico",
  "app/favicon.png",
  "app/icon.svg",
  "app/icon.png",
  "app/icon.ico",
  "src/favicon.ico",
  "src/favicon.svg",
  "src/app/favicon.ico",
  "src/app/icon.svg",
  "src/app/icon.png",
  "assets/icon.svg",
  "assets/icon.png",
  "assets/logo.svg",
  "assets/logo.png",
];

// Files that may contain a <link rel="icon"> or icon metadata declaration.
const ICON_SOURCE_FILES = [
  "index.html",
  "public/index.html",
  "app/routes/__root.tsx",
  "src/routes/__root.tsx",
  "app/root.tsx",
  "src/root.tsx",
  "src/index.html",
];

// Matches <link ...> tags or object-like icon metadata where rel/href can appear in any order.
const LINK_ICON_HTML_RE =
  /<link\b(?=[^>]*\brel=["'](?:icon|shortcut icon)["'])(?=[^>]*\bhref=["']([^"'?]+))[^>]*>/i;
const LINK_ICON_OBJ_RE =
  /(?=[^}]*\brel\s*:\s*["'](?:icon|shortcut icon)["'])(?=[^}]*\bhref\s*:\s*["']([^"'?]+))[^}]*/i;

function extractIconHref(source: string): string | null {
  const htmlMatch = source.match(LINK_ICON_HTML_RE);
  if (htmlMatch?.[1]) return htmlMatch[1];
  const objMatch = source.match(LINK_ICON_OBJ_RE);
  if (objMatch?.[1]) return objMatch[1];
  return null;
}

function resolveIconHref(projectCwd: string, href: string): string[] {
  const clean = href.replace(/^\//, "");
  return [path.join(projectCwd, "public", clean), path.join(projectCwd, clean)];
}

function isPathWithinProject(projectCwd: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(projectCwd), path.resolve(candidatePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function statFile(filePath: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.stat(filePath);
  } catch {
    return null;
  }
}

async function resolveFirstExistingFilePath(
  projectCwd: string,
  candidatePaths: ReadonlyArray<string>,
): Promise<string | null> {
  for (const candidatePath of candidatePaths) {
    if (!isPathWithinProject(projectCwd, candidatePath)) {
      continue;
    }

    const stats = await statFile(candidatePath);
    if (stats?.isFile()) {
      return candidatePath;
    }
  }

  return null;
}

export async function resolveProjectFaviconFilePath(projectCwd: string): Promise<string | null> {
  for (const relativeCandidate of FAVICON_CANDIDATES) {
    const candidatePath = path.join(projectCwd, relativeCandidate);
    const resolvedPath = await resolveFirstExistingFilePath(projectCwd, [candidatePath]);
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  for (const sourceFileRelativePath of ICON_SOURCE_FILES) {
    const sourceFilePath = path.join(projectCwd, sourceFileRelativePath);
    let content: string;
    try {
      content = await fs.promises.readFile(sourceFilePath, "utf8");
    } catch {
      continue;
    }

    const href = extractIconHref(content);
    if (!href) {
      continue;
    }

    const resolvedPath = await resolveFirstExistingFilePath(
      projectCwd,
      resolveIconHref(projectCwd, href),
    );
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  return null;
}
