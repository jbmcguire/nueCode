import type { EnvironmentId } from "@t3tools/contracts";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LoaderIcon,
  SaveIcon,
} from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { VscodeEntryIcon } from "./chat/VscodeEntryIcon";
import { readEnvironmentApi } from "../environmentApi";
import { openInPreferredEditor } from "../editorPreferences";
import { useTheme } from "../hooks/useTheme";
import { ensureLocalApi } from "../localApi";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Textarea } from "./ui/textarea";

function joinWorkspacePath(workspaceRoot: string, relativePath?: string): string {
  if (!relativePath) {
    return workspaceRoot;
  }
  return workspaceRoot.endsWith("/")
    ? workspaceRoot + relativePath
    : workspaceRoot + "/" + relativePath;
}

function basenameOf(relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }
  const segments = relativePath.split("/");
  return segments[segments.length - 1] ?? null;
}

function parentPathOf(relativePath: string | null | undefined): string | undefined {
  if (!relativePath) {
    return undefined;
  }
  const separatorIndex = relativePath.lastIndexOf("/");
  return separatorIndex === -1 ? undefined : relativePath.slice(0, separatorIndex);
}

interface FilesPanelProps {
  active: boolean;
  environmentId: EnvironmentId;
  initialFilePath?: string | null;
  onActiveFilePathChange?: (path: string | null) => void;
  workspaceRoot: string | null;
}

export function FilesPanel({
  active,
  environmentId,
  initialFilePath = null,
  onActiveFilePathChange,
  workspaceRoot,
}: FilesPanelProps) {
  const api = readEnvironmentApi(environmentId);
  const { resolvedTheme } = useTheme();
  const [currentDirectoryPath, setCurrentDirectoryPath] = useState<string | undefined>(
    parentPathOf(initialFilePath),
  );
  const [directoryEntries, setDirectoryEntries] = useState<
    ReadonlyArray<{ name: string; relativePath: string; kind: "directory" | "file" }>
  >([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(initialFilePath);
  const [loadedContents, setLoadedContents] = useState("");
  const [editorContents, setEditorContents] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [loadedFilePath, setLoadedFilePath] = useState<string | null>(null);
  const previousWorkspaceRoot = useRef<string | null>(workspaceRoot);

  useEffect(() => {
    if (previousWorkspaceRoot.current === workspaceRoot) {
      return;
    }
    previousWorkspaceRoot.current = workspaceRoot;
    setCurrentDirectoryPath(parentPathOf(initialFilePath));
    setSelectedFilePath(initialFilePath);
    setLoadedContents("");
    setEditorContents("");
    setLoadedFilePath(null);
    setDirectoryEntries([]);
    setDirectoryError(null);
    setFileError(null);
  }, [initialFilePath, workspaceRoot]);

  const loadDirectory = useCallback(
    async (relativePath?: string) => {
      if (!workspaceRoot || !api) {
        return;
      }
      setDirectoryLoading(true);
      setDirectoryError(null);
      try {
        const result = await api.projects.listEntries({
          cwd: workspaceRoot,
          ...(relativePath ? { relativePath } : {}),
        });
        setDirectoryEntries(result.entries);
        setCurrentDirectoryPath(result.directoryPath);
      } catch (error) {
        setDirectoryError(error instanceof Error ? error.message : "Failed to list files.");
      } finally {
        setDirectoryLoading(false);
      }
    },
    [api, workspaceRoot],
  );

  const loadFile = useCallback(
    async (relativePath: string) => {
      if (!workspaceRoot || !api) {
        return;
      }
      setFileLoading(true);
      setFileError(null);
      try {
        const result = await api.projects.readFile({
          cwd: workspaceRoot,
          relativePath,
        });
        setSelectedFilePath(result.relativePath);
        setLoadedContents(result.contents);
        setEditorContents(result.contents);
        setLoadedFilePath(result.relativePath);
        onActiveFilePathChange?.(result.relativePath);
      } catch (error) {
        setSelectedFilePath(relativePath);
        setLoadedContents("");
        setEditorContents("");
        setLoadedFilePath(null);
        setFileError(error instanceof Error ? error.message : "Failed to open file.");
        onActiveFilePathChange?.(relativePath);
      } finally {
        setFileLoading(false);
      }
    },
    [api, onActiveFilePathChange, workspaceRoot],
  );

  useEffect(() => {
    if (!active) {
      return;
    }
    void loadDirectory(currentDirectoryPath);
  }, [active, currentDirectoryPath, loadDirectory]);

  useEffect(() => {
    if (!active || !api || !initialFilePath || loadedFilePath === initialFilePath) {
      return;
    }
    setSelectedFilePath(initialFilePath);
    const nextDirectoryPath = parentPathOf(initialFilePath);
    if (nextDirectoryPath !== currentDirectoryPath) {
      setCurrentDirectoryPath(nextDirectoryPath);
    }
    void loadFile(initialFilePath);
  }, [active, api, currentDirectoryPath, initialFilePath, loadFile, loadedFilePath]);

  const goUp = useCallback(() => {
    if (!currentDirectoryPath) {
      return;
    }
    const nextDirectoryPath = parentPathOf(currentDirectoryPath);
    setCurrentDirectoryPath(nextDirectoryPath);
  }, [currentDirectoryPath]);

  const openCurrentSelectionInEditor = useCallback(async () => {
    if (!workspaceRoot) {
      return;
    }
    const localApi = ensureLocalApi();
    const targetPath = joinWorkspacePath(workspaceRoot, selectedFilePath ?? currentDirectoryPath);
    await openInPreferredEditor(localApi, targetPath);
  }, [currentDirectoryPath, selectedFilePath, workspaceRoot]);

  const saveFile = useCallback(async () => {
    if (!workspaceRoot || !api || !selectedFilePath) {
      return;
    }
    setFileSaving(true);
    setFileError(null);
    try {
      const result = await api.projects.writeFile({
        cwd: workspaceRoot,
        relativePath: selectedFilePath,
        contents: editorContents,
      });
      setSelectedFilePath(result.relativePath);
      setLoadedContents(editorContents);
      setLoadedFilePath(result.relativePath);
      onActiveFilePathChange?.(result.relativePath);
      void loadDirectory(currentDirectoryPath);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Failed to save file.");
    } finally {
      setFileSaving(false);
    }
  }, [
    api,
    currentDirectoryPath,
    editorContents,
    loadDirectory,
    onActiveFilePathChange,
    selectedFilePath,
    workspaceRoot,
  ]);

  const isDirty = selectedFilePath !== null && editorContents !== loadedContents;
  const selectedFileName = basenameOf(selectedFilePath);

  const handleEditorKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key.toLowerCase() !== "s") {
        return;
      }
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      if (!isDirty || fileSaving || fileLoading) {
        return;
      }
      event.preventDefault();
      void saveFile();
    },
    [fileLoading, fileSaving, isDirty, saveFile],
  );

  if (!workspaceRoot) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        File explorer is unavailable until this thread has an active workspace.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 bg-[color-mix(in_srgb,var(--background)_96%,black)]">
      <div className="flex min-h-0 w-80 shrink-0 flex-col border-r border-border/80">
        <div className="flex items-center gap-2 border-b border-border/80 px-3 py-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-accent/55 px-3 py-2 text-sm font-medium tracking-[-0.01em] text-foreground transition-colors hover:bg-accent"
          >
            <span>All files</span>
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!currentDirectoryPath}
            onClick={goUp}
            aria-label="Go to parent directory"
            className="ml-auto"
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
        </div>
        <div className="border-b border-border/60 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/45">
          {currentDirectoryPath ?? "Workspace root"}
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-0.5 px-2 py-2">
            {directoryLoading ? (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                <LoaderIcon className="size-3.5 animate-spin" />
                Loading files...
              </div>
            ) : directoryError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {directoryError}
              </div>
            ) : directoryEntries.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground/70">
                No files in this directory.
              </div>
            ) : (
              directoryEntries.map((entry) => {
                const isSelected = entry.relativePath === selectedFilePath;
                const isDirectory = entry.kind === "directory";
                return (
                  <button
                    key={entry.relativePath}
                    type="button"
                    onClick={() => {
                      if (isDirectory) {
                        setCurrentDirectoryPath(entry.relativePath);
                        setSelectedFilePath(null);
                        onActiveFilePathChange?.(null);
                        return;
                      }
                      void loadFile(entry.relativePath);
                    }}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[15px] tracking-[-0.01em] transition-all duration-150 ease-out",
                      isSelected
                        ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--border)_68%,transparent)]"
                        : "text-foreground/88 hover:bg-accent/40 hover:text-foreground",
                    )}
                  >
                    {isDirectory ? (
                      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/55 transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-foreground" />
                    ) : (
                      <span className="size-3.5 shrink-0" />
                    )}
                    <VscodeEntryIcon
                      pathValue={entry.name}
                      kind={entry.kind}
                      theme={resolvedTheme}
                      className="size-4 shrink-0"
                    />
                    <span className="min-w-0 truncate">{entry.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
              {selectedFileName ?? "Workspace file"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {selectedFilePath ?? "Open a text file to edit it inline."}
            </div>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void openCurrentSelectionInEditor()}
            disabled={!selectedFilePath}
          >
            <ExternalLinkIcon className="size-3.5" />
            Open
          </Button>
          <Button
            size="xs"
            onClick={() => void saveFile()}
            disabled={!isDirty || fileSaving || fileLoading}
          >
            {fileSaving ? (
              <LoaderIcon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            Save
          </Button>
        </div>
        {fileError ? (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
            {fileError}
          </div>
        ) : null}
        {!selectedFilePath ? (
          <div className="flex flex-1 items-center justify-center px-8 text-center">
            <div className="max-w-sm space-y-2">
              <p className="text-sm font-medium tracking-[-0.01em] text-foreground">
                Open a source file
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Use the workspace tree to open a text file. The current selection stays lightweight
                and editable here.
              </p>
            </div>
          </div>
        ) : fileLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
            <LoaderIcon className="size-3.5 animate-spin" />
            Loading file...
          </div>
        ) : (
          <div className="min-h-0 flex-1 p-3">
            <Textarea
              value={editorContents}
              onChange={(event) => setEditorContents(event.target.value)}
              onKeyDown={handleEditorKeyDown}
              className="h-full rounded-2xl border border-border/70 bg-black/12 px-4 py-3 font-mono text-[13px] leading-6 tracking-[-0.01em]"
              unstyled
              spellCheck={false}
              aria-label="Inspector file editor"
            />
          </div>
        )}
      </div>
    </div>
  );
}
