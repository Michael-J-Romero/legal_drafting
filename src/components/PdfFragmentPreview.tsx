"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PdfFragment } from "@/lib/fragments";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

import styles from "./PdfFragmentPreview.module.css";

const WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export type PdfFragmentPreviewProps = {
  fragment: PdfFragment;
};

type DocumentLoadSuccess = {
  numPages: number;
};

export function PdfFragmentPreview({ fragment }: PdfFragmentPreviewProps) {
  const [numPages, setNumPages] = useState<number>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  }, []);

  const pageNumbers = useMemo(() => {
    if (fragment.pages && fragment.pages.length > 0) {
      return fragment.pages.map((page) => page + 1);
    }

    if (!numPages) {
      return [];
    }

    return Array.from({ length: numPages }, (_, index) => index + 1);
  }, [fragment.pages, numPages]);

  function handleLoadSuccess({ numPages: resolvedPages }: DocumentLoadSuccess) {
    setNumPages(resolvedPages);
  }

  return (
    <section className={styles.container} aria-label={fragment.label ?? "PDF fragment"}>
      <Document
        file={fragment.src}
        loading={<Placeholder message="Loading PDF preview…" />}
        error={
          <Placeholder
            message={
              error ?? "We couldn't load this PDF preview. Check the file path and try again."
            }
          />
        }
        onLoadSuccess={handleLoadSuccess}
        onLoadError={(loadError) => setError(loadError.message)}
      >
        {pageNumbers.map((pageNumber) => (
          <Page
            key={`${fragment.id}-${pageNumber}`}
            pageNumber={pageNumber}
            width={816}
            renderAnnotationLayer={false}
            renderTextLayer
            className={styles.page}
          />
        ))}
      </Document>
      {pageNumbers.length === 0 && !error ? (
        <Placeholder message="Preparing PDF pages…" />
      ) : null}
    </section>
  );
}

type PlaceholderProps = {
  message: string;
};

function Placeholder({ message }: PlaceholderProps) {
  return <div className={styles.placeholder}>{message}</div>;
}
