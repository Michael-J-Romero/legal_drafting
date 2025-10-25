import { useEffect, useState } from "react";

/**
 * Dynamically load the experimental Paged.js library.
 * This hook allows us to opt-in without bloating the initial bundle.
 */
export function usePagedJs(enabled: boolean) {
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    let isMounted = true;

    import("pagedjs").then(() => {
      if (isMounted) {
        setReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  return isReady;
}
