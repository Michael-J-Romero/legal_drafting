"use client";

import { RefObject, useCallback } from "react";
import { useReactToPrint } from "react-to-print";

type UsePrintOptions = {
  documentTitle?: string;
};

export const usePrint = <T extends HTMLElement>(
  targetRef: RefObject<T>,
  { documentTitle }: UsePrintOptions = {}
) => {
  const handlePrint = useReactToPrint({
    content: () => targetRef.current,
    documentTitle
  });

  return useCallback(() => {
    if (!targetRef.current) {
      console.warn("Nothing to print yet. Attach the ref to a DOM node.");
      return;
    }

    handlePrint?.();
  }, [handlePrint, targetRef]);
};
