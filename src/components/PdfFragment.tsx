"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import styles from "@/styles/PdfFragment.module.css";
import type { PdfFragment as PdfFragmentType } from "@/lib/types";

type Props = {
  fragment: PdfFragmentType;
};

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export function PdfFragment({ fragment }: Props) {
  const [numPages, setNumPages] = useState<number>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [fragment.content]);

  const pageNumbers = useMemo(() => {
    if (!numPages) {
      return [];
    }

    if (!fragment.pageRange) {
      return Array.from({ length: numPages }, (_, index) => index + 1);
    }

    const [start, end] = fragment.pageRange;
    const safeStart = Math.max(1, start);
    const safeEnd = Math.min(end ?? numPages, numPages);
    return Array.from(
      { length: safeEnd - safeStart + 1 },
      (_, index) => safeStart + index
    );
  }, [fragment.pageRange, numPages]);

  return (
    <section className={styles.fragment} data-fragment-id={fragment.id}>
      <Document
        file={fragment.content}
        loading={<div className={styles.status}>Loading PDF…</div>}
        error={<div className={styles.status}>Unable to load PDF.</div>}
        onLoadSuccess={({ numPages: nextNumPages }) => setNumPages(nextNumPages)}
        onLoadError={(loadError) => {
          console.error(loadError);
          setError(loadError.message);
        }}
      >
        {error ? (
          <div className={styles.status}>{error}</div>
        ) : (
          pageNumbers.map((pageNumber) => (
            <Page
              key={pageNumber}
              pageNumber={pageNumber}
              className={styles.page}
              width={816}
              renderAnnotationLayer={false}
              renderTextLayer
            />
          ))
        )}
      </Document>
    </section>
  );
}
