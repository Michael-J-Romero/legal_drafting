"use client";

import { useCallback, useRef } from "react";
import type { DocumentFragment } from "@/lib/fragments";
import { FragmentPreview } from "./FragmentPreview";
import { useReactToPrint } from "react-to-print";

import styles from "./PrintPreview.module.css";
import { usePagedPreview } from "./usePagedPreview";

type Props = {
  fragments: DocumentFragment[];
  enablePagedPreview?: boolean;
};

export function PrintPreview({ fragments, enablePagedPreview = false }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    removeAfterPrint: false
  });

  usePagedPreview(enablePagedPreview, previewRef);

  const onPrintClick = useCallback(() => {
    handlePrint?.();
  }, [handlePrint]);

  return (
    <div className={styles.wrapper}>
      <header className={styles.toolbar}>
        <div>
          <h1>Draft preview</h1>
          <p className={styles.subtitle}>
            Assemble markdown and PDF fragments into a paginated, printer-friendly view.
          </p>
        </div>
        <button type="button" className={styles.printButton} onClick={onPrintClick}>
          Print or Save as PDF
        </button>
      </header>
      <FragmentPreview fragments={fragments} ref={previewRef} />
    </div>
  );
}
