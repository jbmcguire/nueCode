import { describe, expect, it } from "vitest";

import { parseBrowserRouteSearch, stripBrowserSearchParams } from "./browserRouteSearch";

describe("parseBrowserRouteSearch", () => {
  it("parses valid browser search values", () => {
    expect(
      parseBrowserRouteSearch({
        browser: "1",
        browserUrl: "http://localhost:3000",
      }),
    ).toEqual({
      browser: "1",
      browserUrl: "http://localhost:3000",
    });
  });

  it("treats numeric and boolean browser toggles as open", () => {
    expect(
      parseBrowserRouteSearch({
        browser: 1,
        browserUrl: "http://localhost:3000",
      }),
    ).toEqual({
      browser: "1",
      browserUrl: "http://localhost:3000",
    });

    expect(
      parseBrowserRouteSearch({
        browser: true,
        browserUrl: "http://localhost:3000",
      }),
    ).toEqual({
      browser: "1",
      browserUrl: "http://localhost:3000",
    });
  });

  it("drops browserUrl when the browser panel is closed", () => {
    expect(
      parseBrowserRouteSearch({
        browser: "0",
        browserUrl: "http://localhost:3000",
      }),
    ).toEqual({});
  });

  it("normalizes whitespace-only browserUrl values", () => {
    expect(
      parseBrowserRouteSearch({
        browser: "1",
        browserUrl: "   ",
      }),
    ).toEqual({
      browser: "1",
    });
  });
});

describe("stripBrowserSearchParams", () => {
  it("removes browser-specific keys while preserving unrelated search state", () => {
    expect(
      stripBrowserSearchParams({
        browser: "1",
        browserUrl: "http://localhost:3000",
        diff: "1",
      }),
    ).toEqual({
      diff: "1",
    });
  });
});
