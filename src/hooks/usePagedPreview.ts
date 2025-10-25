import { useEffect } from 'react';

/**
 * Lightweight hook that optionally loads Paged.js when the component mounts.
 * Paged.js enables CSS Paged Media features so that on-screen previews more
 * closely match print layout. The library is large, so we only load it on the
 * client and ignore any errors (for example during SSR or if the user removes
 * the script).
 */
export const usePagedPreview = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    const loadPagedJs = async () => {
      try {
        await import('pagedjs');
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Paged.js] failed to load', error);
        }
      }
    };

    loadPagedJs();

    return () => {
      cancelled = true;
      return cancelled;
    };
  }, [enabled]);
};
