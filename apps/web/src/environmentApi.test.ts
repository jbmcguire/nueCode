import { describe, expect, it, vi } from "vitest";

import { createEnvironmentApi } from "./environmentApi";

function createRpcClientMock() {
  return {
    terminal: {
      open: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      clear: vi.fn(),
      restart: vi.fn(),
      close: vi.fn(),
      onEvent: vi.fn(),
    },
    projects: {
      listEntries: vi.fn(),
      readFile: vi.fn(),
      searchEntries: vi.fn(),
      writeFile: vi.fn(),
    },
    filesystem: {
      browse: vi.fn(),
    },
    git: {
      pull: vi.fn(),
      refreshStatus: vi.fn(),
      onStatus: vi.fn(),
      listBranches: vi.fn(),
      createWorktree: vi.fn(),
      removeWorktree: vi.fn(),
      createBranch: vi.fn(),
      checkout: vi.fn(),
      init: vi.fn(),
      resolvePullRequest: vi.fn(),
      preparePullRequestThread: vi.fn(),
    },
    orchestration: {
      dispatchCommand: vi.fn(),
      getTurnDiff: vi.fn(),
      getFullThreadDiff: vi.fn(),
      subscribeShell: vi.fn(),
      subscribeThread: vi.fn(),
    },
  } as const;
}

describe("createEnvironmentApi", () => {
  it("returns the same api wrapper for the same rpc client", () => {
    const rpcClient = createRpcClientMock();

    const firstApi = createEnvironmentApi(rpcClient as never);
    const secondApi = createEnvironmentApi(rpcClient as never);

    expect(firstApi).toBe(secondApi);
  });

  it("returns a distinct api wrapper for a different rpc client", () => {
    const firstClient = createRpcClientMock();
    const secondClient = createRpcClientMock();

    const firstApi = createEnvironmentApi(firstClient as never);
    const secondApi = createEnvironmentApi(secondClient as never);

    expect(firstApi).not.toBe(secondApi);
  });
});
