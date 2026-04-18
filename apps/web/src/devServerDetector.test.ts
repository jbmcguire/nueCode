import { describe, expect, it } from "vitest";

import { extractLocalhostUrl } from "./devServerDetector";

describe("extractLocalhostUrl", () => {
  it("detects localhost URLs from common dev-server output", () => {
    expect(extractLocalhostUrl("  Local:   http://127.0.0.1:5733/")).toBe("http://127.0.0.1:5733/");
    expect(extractLocalhostUrl("Server running at http://localhost:3000.")).toBe(
      "http://localhost:3000",
    );
  });

  it("converts captured port-only output into a localhost URL", () => {
    expect(extractLocalhostUrl("ready started server on http://0.0.0.0:3000")).toBe(
      "http://localhost:3000",
    );
    expect(extractLocalhostUrl("ready app started server on port:5173")).toBe(
      "http://localhost:5173",
    );
  });

  it("returns null when no preview URL is present", () => {
    expect(extractLocalhostUrl("Compiled successfully with no preview URL.")).toBeNull();
  });

  it("accepts network URLs from dev-server output", () => {
    expect(extractLocalhostUrl("Network: https://192.168.1.20:3000")).toBe(
      "https://192.168.1.20:3000",
    );
  });
});
