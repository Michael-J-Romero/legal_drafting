'use client';

import React, { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PdfFragment as PdfFragmentType } from '@/types/document';

// Configure the worker source to leverage a CDN fallback.
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc =
    pdfjs.GlobalWorkerOptions.workerSrc ||
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.js';
}

interface PdfFragmentProps {
  fragment: PdfFragmentType;
}

const PdfFragment: React.FC<PdfFragmentProps> = ({ fragment }) => {
  const [numPages, setNumPages] = useState<number>(0);

  const pageNumbers = useMemo(() => {
    if (!numPages) {
      return [];
    }

    if (!fragment.pageRange) {
      return Array.from({ length: numPages }, (_, index) => index + 1);
    }

    const [start, end] = fragment.pageRange;
    const safeEnd = Math.min(end ?? numPages, numPages);
    return Array.from({ length: safeEnd - start }, (_, index) => start + index + 1).filter(
      (page) => page >= 1 && page <= numPages,
    );
  }, [fragment.pageRange, numPages]);

  return (
    <section data-fragment-id={fragment.id} aria-label={fragment.label ?? 'PDF fragment'}>
      <div style={{ padding: '2rem' }}>
        <Document
          file={fragment.src}
          onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
          loading={<p>Loading PDF…</p>}
          error={<p>Unable to load PDF fragment.</p>}
        >
          {pageNumbers.map((pageNumber) => (
            <Page
              key={`${fragment.id}-page-${pageNumber}`}
              pageNumber={pageNumber}
              width={800}
              renderAnnotationLayer={false}
              renderTextLayer
            />
          ))}
        </Document>
      </div>
    </section>
  );
};

export default PdfFragment;
