"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PdfFragment } from "@/lib/fragments";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Configure the worker lazily so builds do not fail when the asset is missing.
let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    workerConfigured = true;
  } catch (error) {
    console.warn("react-pdf worker could not be initialised", error);
  }
}

export type PdfFragmentProps = {
  fragment: PdfFragment;
};

export function PdfFragmentRenderer({ fragment }: PdfFragmentProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    ensureWorker();
  }, []);

  const pagesToRender = useMemo(() => {
    if (!fragment.pages || fragment.pages.length === 0) {
      return undefined;
    }
    return fragment.pages.map((pageIndex) => pageIndex + 1);
  }, [fragment.pages]);

  if (!fragment.src) {
    return (
      <div className="pdf-fragment pdf-fragment--placeholder">
        <p>No PDF attached yet. Drop a file to preview it.</p>
      </div>
    );
  }

  if (!isClient) {
    return null;
  }

  return (
    <div className="pdf-fragment" data-fragment-id={fragment.id}>
      <Document file={fragment.src} loading={<span>Loading PDF…</span>}>
        {pagesToRender ? (
          pagesToRender.map((pageNumber) => (
            <Page
              key={`${fragment.id}-${pageNumber}`}
              pageNumber={pageNumber}
              width={768}
            />
          ))
        ) : (
          <Page pageNumber={1} width={768} />
        )}
      </Document>
    </div>
  );
}
