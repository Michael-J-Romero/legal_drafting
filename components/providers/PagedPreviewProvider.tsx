"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type PagedPreviewContextValue = {
  isReady: boolean;
  error?: Error;
};

const PagedPreviewContext = createContext<PagedPreviewContextValue | undefined>(
  undefined
);

export type PagedPreviewProviderProps = {
  children: React.ReactNode;
  enable?: boolean;
};

export function PagedPreviewProvider({
  children,
  enable = false,
}: PagedPreviewProviderProps) {
  const [state, setState] = useState<PagedPreviewContextValue>({
    isReady: !enable,
  });

  useEffect(() => {
    if (!enable) return;

    let cancelled = false;

    async function loadPagedJs() {
      try {
        const module = await import("pagedjs");
        if (!cancelled && module) {
          setState({ isReady: true });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ isReady: false, error: error as Error });
        }
      }
    }

    loadPagedJs();

    return () => {
      cancelled = true;
    };
  }, [enable]);

  const value = useMemo(() => state, [state]);

  return (
    <PagedPreviewContext.Provider value={value}>
      {children}
    </PagedPreviewContext.Provider>
  );
}

export function usePagedPreview() {
  const context = useContext(PagedPreviewContext);
  if (!context) {
    throw new Error("usePagedPreview must be used within a PagedPreviewProvider");
  }
  return context;
}
