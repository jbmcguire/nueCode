import { describe, expect, it } from "vitest";

import {
  CONSOLE_BRIDGE_SOURCE,
  consoleEntryFromMessage,
  formatNetworkDuration,
  formatNetworkStatus,
  getNetworkPathLabel,
  isConsoleBridgeMessage,
  isNetworkBridgeMessage,
  networkEntryFromMessage,
} from "./browserBridgeEvents";

describe("browserBridgeEvents", () => {
  it("recognizes console bridge messages", () => {
    expect(
      isConsoleBridgeMessage({
        source: CONSOLE_BRIDGE_SOURCE,
        type: "console",
        level: "warn",
        args: ["problem"],
        timestamp: Date.now(),
      }),
    ).toBe(true);

    expect(
      isConsoleBridgeMessage({
        source: CONSOLE_BRIDGE_SOURCE,
        type: "console",
        level: "trace",
        args: ["problem"],
        timestamp: Date.now(),
      }),
    ).toBe(false);
  });

  it("recognizes network bridge messages", () => {
    expect(
      isNetworkBridgeMessage({
        source: CONSOLE_BRIDGE_SOURCE,
        type: "network",
        requestId: "req-1",
        kind: "fetch",
        method: "get",
        url: "http://localhost:3000/api/health",
        timestamp: Date.now(),
        ok: true,
        statusCode: 200,
      }),
    ).toBe(true);

    expect(
      isNetworkBridgeMessage({
        source: CONSOLE_BRIDGE_SOURCE,
        type: "network",
        requestId: "",
        kind: "fetch",
        method: "get",
        url: "http://localhost:3000/api/health",
        timestamp: Date.now(),
        ok: true,
      }),
    ).toBe(false);
  });

  it("maps bridge messages into UI entries", () => {
    expect(
      consoleEntryFromMessage(
        {
          source: CONSOLE_BRIDGE_SOURCE,
          type: "console",
          level: "info",
          args: ["ready"],
          timestamp: 1,
          url: "http://localhost:3000",
        },
        7,
      ),
    ).toEqual({
      id: 7,
      level: "info",
      args: ["ready"],
      timestamp: 1,
      url: "http://localhost:3000",
    });

    expect(
      networkEntryFromMessage(
        {
          source: CONSOLE_BRIDGE_SOURCE,
          type: "network",
          requestId: "req-2",
          kind: "xhr",
          method: "post",
          url: "http://localhost:3000/api/save",
          timestamp: 2,
          ok: false,
          statusCode: 500,
          errorMessage: "Internal Server Error",
          durationMs: 123.4,
        },
        8,
      ),
    ).toEqual({
      id: 8,
      requestId: "req-2",
      kind: "xhr",
      method: "POST",
      url: "http://localhost:3000/api/save",
      timestamp: 2,
      ok: false,
      statusCode: 500,
      errorMessage: "Internal Server Error",
      durationMs: 123.4,
    });
  });

  it("formats network labels for happy path, failure, and edge cases", () => {
    expect(formatNetworkDuration(88.4)).toBe("88 ms");
    expect(formatNetworkDuration(1450)).toBe("1.45 s");
    expect(formatNetworkDuration()).toBe("—");

    expect(formatNetworkStatus({ ok: true, statusCode: 204 })).toBe("204");
    expect(formatNetworkStatus({ ok: false, statusCode: null, errorMessage: "Timed out" })).toBe(
      "Timed out",
    );
    expect(formatNetworkStatus({ ok: false, statusCode: null })).toBe("Failed");

    expect(getNetworkPathLabel("http://localhost:3000/api/items?limit=10")).toBe(
      "localhost:3000/api/items?limit=10",
    );
    expect(getNetworkPathLabel("not a url")).toBe("not a url");
  });
});
