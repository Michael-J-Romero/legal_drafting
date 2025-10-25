"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PdfFragment as PdfFragmentType } from "@/types/fragments";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

interface PdfFragmentProps {
  fragment: PdfFragmentType;
}

const PdfFragment: React.FC<PdfFragmentProps> = ({ fragment }) => {
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  }, []);

  return (
    <section className="pdf-fragment" aria-label={fragment.title ?? "PDF fragment"}>
      <header>
        <h3>{fragment.title ?? "PDF Attachment"}</h3>
        {numPages > 0 ? <span>{numPages} page{numPages === 1 ? "" : "s"}</span> : null}
      </header>
      <Document
        file={fragment.src}
        onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
        options={{ cMapUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/cmaps/`, cMapPacked: true }}
        loading={<p>Loading PDF…</p>}
        error={<p>Failed to load PDF.</p>}
      >
        {Array.from({ length: numPages }, (_, index) => (
          <Page
            key={`page_${fragment.id}_${index + 1}`}
            pageNumber={index + 1}
            renderAnnotationLayer
            renderTextLayer
          />
        ))}
      </Document>
    </section>
  );
};

export default PdfFragment;
