"use client";

import { useCallback, useRef } from "react";
import { useReactToPrint } from "react-to-print";

export type UsePrintControlsOptions = {
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
};

export function usePrintControls({
  onAfterPrint,
  onBeforePrint,
}: UsePrintControlsOptions = {}) {
  const printTargetRef = useRef<HTMLElement | null>(null);

  const handlePrint = useReactToPrint({
    content: () => printTargetRef.current,
    onBeforePrint,
    onAfterPrint,
    removeAfterPrint: true,
  });

  const registerTarget = useCallback((node: HTMLElement | null) => {
    if (node) {
      printTargetRef.current = node;
    }
  }, []);

  return { handlePrint, registerTarget } as const;
}
