import { describe, expect, it } from "vitest";

import { parseInspectorRouteSearch, stripInspectorSearchParams } from "./inspectorRouteSearch";

describe("parseInspectorRouteSearch", () => {
  it("parses explicit inspector state", () => {
    expect(
      parseInspectorRouteSearch({
        inspector: "1",
        inspectorTab: "files",
        filePath: "src/app.tsx",
      }),
    ).toEqual({
      inspector: "1",
      inspectorTab: "files",
      filePath: "src/app.tsx",
    });
  });

  it("maps legacy browser deep links to preview", () => {
    expect(
      parseInspectorRouteSearch({
        browser: "1",
        browserUrl: "http://localhost:3000",
      }),
    ).toEqual({
      inspector: "1",
      inspectorTab: "preview",
      browserUrl: "http://localhost:3000",
    });
  });

  it("maps legacy diff deep links to changes", () => {
    expect(
      parseInspectorRouteSearch({
        diff: "1",
        diffTurnId: "turn-1",
        diffFilePath: "src/app.tsx",
      }),
    ).toEqual({
      inspector: "1",
      inspectorTab: "changes",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.tsx",
    });
  });

  it("retains inspectorTab when the panel is closed", () => {
    expect(
      parseInspectorRouteSearch({
        inspectorTab: "review",
      }),
    ).toEqual({
      inspectorTab: "review",
    });
  });
});

describe("stripInspectorSearchParams", () => {
  it("removes inspector and legacy panel keys", () => {
    expect(
      stripInspectorSearchParams({
        inspector: "1",
        inspectorTab: "preview",
        browser: "1",
        browserUrl: "http://localhost:3000",
        diff: "1",
        diffTurnId: "turn-1",
        diffFilePath: "src/app.tsx",
        filePath: "README.md",
        q: "keep",
      }),
    ).toEqual({
      q: "keep",
    });
  });
});
