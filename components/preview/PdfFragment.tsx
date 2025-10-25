"use client";

import { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PdfFragment } from "@/types/content";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

const WORKER_SRC = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions.workerSrc !== WORKER_SRC) {
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
}

interface PdfFragmentProps {
  fragment: PdfFragment;
}

export default function PdfFragmentView({ fragment }: PdfFragmentProps) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pages = useMemo(() => {
    if (!pageCount) return [];
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }, [pageCount]);

  return (
    <article>
      {fragment.label ? <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "#2563eb" }}>{fragment.label}</p> : null}
      {fragment.note ? <p style={{ marginTop: 0, color: "#4b5563" }}>{fragment.note}</p> : null}
      <div style={{ border: "1px solid rgba(148, 163, 184, 0.4)", borderRadius: "0.5rem", overflow: "hidden" }}>
        <Document
          file={fragment.src}
          loading={<p style={{ padding: "1.5rem", margin: 0 }}>Loading PDF preview…</p>}
          onLoadSuccess={(payload) => {
            setPageCount(payload.numPages);
            setLoadError(null);
          }}
          onLoadError={(error) => {
            console.error(error);
            setLoadError("Unable to load PDF preview. Confirm that the file exists in public/pdfs.");
          }}
        >
          {pages.map((pageNumber) => (
            <Page key={pageNumber} pageNumber={pageNumber} width={744} renderAnnotationLayer renderTextLayer />
          ))}
        </Document>
      </div>
      {loadError ? (
        <p style={{ color: "#dc2626", marginTop: "0.75rem" }}>{loadError}</p>
      ) : pageCount ? (
        <p style={{ color: "#4b5563", marginTop: "0.75rem" }}>Rendered {pageCount} page(s) from PDF.</p>
      ) : null}
    </article>
  );
}
