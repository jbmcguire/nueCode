import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDebouncedStorage, createMemoryStorage } from "./lib/storage";

const BROWSER_PANEL_STORAGE_KEY = "t3code:browser-panel:v1";
const BROWSER_PANEL_STORAGE_VERSION = 1;
const BROWSER_PANEL_PERSIST_DEBOUNCE_MS = 300;

const browserDebouncedStorage = createDebouncedStorage(
  typeof localStorage !== "undefined" ? localStorage : createMemoryStorage(),
  BROWSER_PANEL_PERSIST_DEBOUNCE_MS,
);

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    browserDebouncedStorage.flush();
  });
}

interface BrowserPanelState {
  urlByThreadId: Record<string, string>;
  detectedUrlByThreadId: Record<string, string>;
  setUrl: (threadId: string, url: string) => void;
  setDetectedUrl: (threadId: string, url: string) => void;
  getUrl: (threadId: string) => string | null;
}

export const useBrowserPanelStore = create<BrowserPanelState>()(
  persist(
    (set, get) => ({
      urlByThreadId: {},
      detectedUrlByThreadId: {},

      setUrl: (threadId, url) => {
        set((state) => ({
          urlByThreadId: { ...state.urlByThreadId, [threadId]: url },
        }));
      },

      setDetectedUrl: (threadId, url) => {
        set((state) => {
          if (state.detectedUrlByThreadId[threadId] === url) return state;
          return {
            detectedUrlByThreadId: { ...state.detectedUrlByThreadId, [threadId]: url },
          };
        });
      },

      getUrl: (threadId) => {
        const state = get();
        return state.urlByThreadId[threadId] ?? state.detectedUrlByThreadId[threadId] ?? null;
      },
    }),
    {
      name: BROWSER_PANEL_STORAGE_KEY,
      version: BROWSER_PANEL_STORAGE_VERSION,
      storage: createJSONStorage(() => browserDebouncedStorage),
      partialize: (state) => ({
        urlByThreadId: state.urlByThreadId,
        detectedUrlByThreadId: state.detectedUrlByThreadId,
      }),
    },
  ),
);
