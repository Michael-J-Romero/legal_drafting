'use client';

import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PdfFragment } from '@/types/document';
import styles from './document-preview.module.css';

// Configure the PDF.js worker at runtime to avoid bundler warnings.
if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions.workerSrc === undefined) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

type PdfFragmentRendererProps = {
  fragment: PdfFragment;
};

export default function PdfFragmentRenderer({ fragment }: PdfFragmentRendererProps) {
  const [numPages, setNumPages] = useState<number>();

  useEffect(() => {
    setNumPages(undefined);
  }, [fragment.src]);

  if (!fragment.src) {
    return (
      <div className={styles.pdfFallback}>
        No PDF source provided. Supply a URL or data URI to render this fragment.
      </div>
    );
  }

  return (
    <div>
      <Document
        file={fragment.src}
        onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
        loading={<div>Loading PDF…</div>}
        error={<div className={styles.pdfFallback}>Unable to load PDF fragment.</div>}
      >
        {Array.from(new Array(numPages ?? 0), (_el, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            renderTextLayer
            renderAnnotationLayer
            width={720}
          />
        ))}
      </Document>
    </div>
  );
}
