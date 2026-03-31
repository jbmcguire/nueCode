import { type ThreadId } from "@t3tools/contracts";
import { useEffect, useRef } from "react";

import { extractLocalhostUrl } from "../devServerDetector";
import { readNativeApi } from "../nativeApi";
import { useBrowserPanelStore } from "../browserPanelStore";

export function useDevServerDetection(threadId: ThreadId) {
  const setDetectedUrl = useBrowserPanelStore((state) => state.setDetectedUrl);
  const hasDetectedRef = useRef(false);

  useEffect(() => {
    hasDetectedRef.current = false;
  }, [threadId]);

  useEffect(() => {
    const api = readNativeApi();
    if (!api) return;

    const unsubscribe = api.terminal.onEvent((event) => {
      if (hasDetectedRef.current) return;
      if (event.threadId !== threadId) return;
      if (event.type !== "output") return;

      const url = extractLocalhostUrl(event.data);
      if (!url) return;

      hasDetectedRef.current = true;
      setDetectedUrl(threadId, url);
    });

    return unsubscribe;
  }, [threadId, setDetectedUrl]);
}
