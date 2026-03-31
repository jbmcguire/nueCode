import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { FALLBACK_PROJECT_FAVICON_SVG, resolveProjectFaviconFilePath } from "./projectFavicon";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("resolveProjectFaviconFilePath", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("finds a well-known favicon file from the project root", async () => {
    const projectDir = makeTempDir("t3code-favicon-route-root-");
    const faviconPath = path.join(projectDir, "favicon.svg");
    fs.writeFileSync(faviconPath, "<svg>favicon</svg>", "utf8");

    await expect(resolveProjectFaviconFilePath(projectDir)).resolves.toBe(faviconPath);
  });

  it("resolves icon href from source files when no well-known favicon exists", async () => {
    const projectDir = makeTempDir("t3code-favicon-route-source-");
    const iconPath = path.join(projectDir, "public", "brand", "logo.svg");
    fs.mkdirSync(path.dirname(iconPath), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "index.html"),
      '<link rel="icon" href="/brand/logo.svg">',
    );
    fs.writeFileSync(iconPath, "<svg>brand</svg>", "utf8");

    await expect(resolveProjectFaviconFilePath(projectDir)).resolves.toBe(iconPath);
  });

  it("resolves icon link when href appears before rel in HTML", async () => {
    const projectDir = makeTempDir("t3code-favicon-route-html-order-");
    const iconPath = path.join(projectDir, "public", "brand", "logo.svg");
    fs.mkdirSync(path.dirname(iconPath), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "index.html"),
      '<link href="/brand/logo.svg" rel="icon">',
    );
    fs.writeFileSync(iconPath, "<svg>brand-html-order</svg>", "utf8");

    await expect(resolveProjectFaviconFilePath(projectDir)).resolves.toBe(iconPath);
  });

  it("resolves object-style icon metadata when href appears before rel", async () => {
    const projectDir = makeTempDir("t3code-favicon-route-obj-order-");
    const iconPath = path.join(projectDir, "public", "brand", "obj.svg");
    fs.mkdirSync(path.dirname(iconPath), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "src", "root.tsx"),
      'const links = [{ href: "/brand/obj.svg", rel: "icon" }];',
      "utf8",
    );
    fs.writeFileSync(iconPath, "<svg>brand-obj-order</svg>", "utf8");

    await expect(resolveProjectFaviconFilePath(projectDir)).resolves.toBe(iconPath);
  });

  it("returns null when no project icon exists so the route can use the inline fallback", async () => {
    const projectDir = makeTempDir("t3code-favicon-route-fallback-");

    await expect(resolveProjectFaviconFilePath(projectDir)).resolves.toBeNull();
    expect(FALLBACK_PROJECT_FAVICON_SVG).toContain('data-fallback="project-favicon"');
  });
});
