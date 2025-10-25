'use client';

import { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from '@wojtekmaj/react-pdf';
import type { PdfFragment as PdfFragmentType } from '../../lib/fragmentTypes';
import '@wojtekmaj/react-pdf/dist/esm/Page/AnnotationLayer.css';
import '@wojtekmaj/react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

type Props = {
  fragment: PdfFragmentType;
  pageWidth?: number;
};

export function PdfFragment({ fragment, pageWidth = 720 }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  return (
    <section className="pdf-fragment" data-fragment-id={fragment.id}>
      <header className="pdf-fragment__header">
        <span>{fragment.title ?? 'PDF Fragment'}</span>
        <span>{numPages ? `${numPages} page${numPages > 1 ? 's' : ''}` : 'Loading…'}</span>
      </header>
      {fragment.src ? (
        <Document
          file={fragment.src}
          onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
          loading={<div className="pdf-fragment__loading">Preparing PDF preview…</div>}
          error={<div className="pdf-fragment__error">Unable to load PDF preview.</div>}
        >
          {pages.map((pageNumber) => (
            <Page
              key={`${fragment.id}-page-${pageNumber}`}
              pageNumber={pageNumber}
              width={pageWidth}
              renderAnnotationLayer
              renderTextLayer
            />
          ))}
        </Document>
      ) : (
        <div className="pdf-fragment__placeholder">
          Provide a `src` URL to display a PDF fragment.
        </div>
      )}
    </section>
  );
}
