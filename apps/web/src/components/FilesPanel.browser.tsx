import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { useState } from "react";

import {
  __resetEnvironmentApiOverridesForTests,
  __setEnvironmentApiOverrideForTests,
} from "../environmentApi";
import { FilesPanel } from "./FilesPanel";

const ENVIRONMENT_ID = "env-files-panel" as never;

function setTextareaValue(textarea: HTMLTextAreaElement, nextValue: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  valueSetter?.call(textarea, nextValue);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("FilesPanel", () => {
  afterEach(() => {
    __resetEnvironmentApiOverridesForTests();
  });

  it("loads the selected file after the environment api becomes available", async () => {
    const screen = await render(
      <FilesPanel
        active
        environmentId={ENVIRONMENT_ID}
        initialFilePath="src/attachmentStore.ts"
        workspaceRoot="/repo"
      />,
    );

    try {
      expect(document.body.textContent).toContain("No files in this directory.");

      __setEnvironmentApiOverrideForTests(ENVIRONMENT_ID, {
        projects: {
          listEntries: vi.fn(async () => ({
            directoryPath: "src",
            entries: [
              { kind: "file", name: "attachmentStore.ts", relativePath: "src/attachmentStore.ts" },
              {
                kind: "file",
                name: "browserPanelStore.ts",
                relativePath: "src/browserPanelStore.ts",
              },
            ],
          })),
          readFile: vi.fn(async () => ({
            relativePath: "src/attachmentStore.ts",
            contents: "export const attachmentStore = new Map();",
          })),
          writeFile: vi.fn(async (input: { relativePath: string }) => ({
            relativePath: input.relativePath,
          })),
        },
      } as never);

      await screen.rerender(
        <FilesPanel
          active
          environmentId={ENVIRONMENT_ID}
          initialFilePath="src/attachmentStore.ts"
          workspaceRoot="/repo"
        />,
      );

      await vi.waitFor(() => {
        expect(document.body.textContent).not.toContain("No files in this directory.");
        const textarea = document.querySelector<HTMLTextAreaElement>(
          'textarea[aria-label="Inspector file editor"]',
        );
        expect(textarea?.value).toContain("attachmentStore");
        expect(document.body.textContent).toContain("browserPanelStore.ts");
      });
    } finally {
      await screen.unmount();
    }
  });

  it("does not reload the file when the parent reflects the active file path back down", async () => {
    const readFile = vi.fn(async () => ({
      relativePath: "src/attachmentStore.ts",
      contents: "export const attachmentStore = new Map();",
    }));

    __setEnvironmentApiOverrideForTests(ENVIRONMENT_ID, {
      projects: {
        listEntries: vi.fn(async () => ({
          directoryPath: "src",
          entries: [
            { kind: "file", name: "attachmentStore.ts", relativePath: "src/attachmentStore.ts" },
            {
              kind: "file",
              name: "browserPanelStore.ts",
              relativePath: "src/browserPanelStore.ts",
            },
          ],
        })),
        readFile,
        writeFile: vi.fn(async (input: { relativePath: string }) => ({
          relativePath: input.relativePath,
        })),
      },
    } as never);

    function Harness() {
      const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
      return (
        <FilesPanel
          active
          environmentId={ENVIRONMENT_ID}
          initialFilePath={activeFilePath}
          onActiveFilePathChange={setActiveFilePath}
          workspaceRoot="/repo"
        />
      );
    }

    const screen = await render(<Harness />);

    try {
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain("attachmentStore.ts");
      });

      const attachmentButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("attachmentStore.ts"),
      );
      attachmentButton?.click();

      await vi.waitFor(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>(
          'textarea[aria-label="Inspector file editor"]',
        );
        expect(textarea?.value).toContain("attachmentStore");
        expect(readFile).toHaveBeenCalledTimes(1);
      });
    } finally {
      await screen.unmount();
    }
  });

  it("saves the active file with the keyboard shortcut", async () => {
    const writeFile = vi.fn(async (input: { relativePath: string }) => ({
      relativePath: input.relativePath,
    }));

    __setEnvironmentApiOverrideForTests(ENVIRONMENT_ID, {
      projects: {
        listEntries: vi.fn(async () => ({
          directoryPath: "src",
          entries: [
            { kind: "file", name: "attachmentStore.ts", relativePath: "src/attachmentStore.ts" },
          ],
        })),
        readFile: vi.fn(async () => ({
          relativePath: "src/attachmentStore.ts",
          contents: "export const attachmentStore = new Map();",
        })),
        writeFile,
      },
    } as never);

    const screen = await render(
      <FilesPanel
        active
        environmentId={ENVIRONMENT_ID}
        initialFilePath="src/attachmentStore.ts"
        workspaceRoot="/repo"
      />,
    );

    try {
      await vi.waitFor(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>(
          'textarea[aria-label="Inspector file editor"]',
        );
        expect(textarea?.value).toContain("attachmentStore");
      });

      const textarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Inspector file editor"]',
      );
      expect(textarea).not.toBeNull();
      if (!textarea) {
        return;
      }

      textarea.focus();
      setTextareaValue(textarea, "export const attachmentStore = new Set();");

      const saveEvent = new KeyboardEvent("keydown", {
        key: "s",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      textarea.dispatchEvent(saveEvent);

      await vi.waitFor(() => {
        expect(writeFile).toHaveBeenCalledWith({
          cwd: "/repo",
          relativePath: "src/attachmentStore.ts",
          contents: "export const attachmentStore = new Set();",
        });
      });
    } finally {
      await screen.unmount();
    }
  });
});
