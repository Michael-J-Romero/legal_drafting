"use client";

import { useEffect } from "react";

export function usePagedPreview(enabled: boolean, containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let isCancelled = false;
    let previewer: { preview: (el: Element) => Promise<void>; cancel?: () => void } | null = null;

    async function setup() {
      const { default: Paged } = await import("pagedjs");
      if (isCancelled || !containerRef.current) {
        return;
      }

      previewer = new Paged.Previewer();
      await previewer.preview(containerRef.current);
    }

    setup();

    return () => {
      isCancelled = true;
      previewer?.cancel?.();
      previewer = null;
    };
  }, [enabled, containerRef]);
}
