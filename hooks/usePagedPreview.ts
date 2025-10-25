'use client';

import { useEffect } from 'react';

/**
 * Optional hook to experiment with paged-media styling powered by paged.js.
 *
 * The hook keeps the integration opt-in because paged.js mutates the DOM to
 * emulate print pagination. Enabling it will progressively enhance the preview
 * without blocking the core Markdown/PDF experience.
 */
export const usePagedPreview = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let isCancelled = false;
    let previewer: { abort?: () => void } | undefined;

    (async () => {
      try {
        const paged = await import('pagedjs');
        if (isCancelled) {
          return;
        }

        const Paged = paged.default ?? paged;
        previewer = new Paged.Previewer();
        await previewer.preview(document.body, [], document.body);
      } catch (error) {
        console.warn('Paged.js preview failed to initialise', error);
      }
    })();

    return () => {
      isCancelled = true;
      previewer?.abort?.();
    };
  }, [enabled]);
};
