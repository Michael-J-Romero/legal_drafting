'use client';

import { useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';

export const usePrint = <T extends HTMLElement>(targetRef: React.RefObject<T>) => {
  const triggerPrint = useReactToPrint({
    content: () => targetRef.current,
    removeAfterPrint: false,
    suppressErrors: false,
  });

  return useCallback(() => {
    if (!targetRef.current) {
      console.warn('Print preview is not ready yet.');
      return;
    }

    triggerPrint?.();
  }, [targetRef, triggerPrint]);
};
