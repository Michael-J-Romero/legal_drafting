'use client';

import React, { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PdfFragment as PdfFragmentType } from '@/types/fragments';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type Props = {
  fragment: PdfFragmentType;
  pageWidth?: number;
};

const PdfFragment: React.FC<Props> = ({ fragment, pageWidth = 744 }) => {
  const [numPages, setNumPages] = useState<number>();

  const pages = useMemo(() => {
    if (!numPages) {
      return [];
    }

    return Array.from({ length: numPages }, (_, index) => index + 1);
  }, [numPages]);

  return (
    <section className="pdf-fragment" aria-label={fragment.label ?? 'PDF fragment'}>
      {fragment.label ? <h2>{fragment.label}</h2> : null}
      <Document
        file={fragment.source}
        loading={<p>Loading PDF…</p>}
        onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
        onLoadError={(error) => console.error('Failed to load PDF fragment', error)}
        options={{ standardFontDataUrl: '/pdfjs-dist/standard_fonts/' }}
      >
        {pages.map((pageNumber) => (
          <div key={`${fragment.id}-page-${pageNumber}`} className="pdf-page-wrapper">
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              renderTextLayer
              renderAnnotationLayer
            />
          </div>
        ))}
      </Document>
      <footer>
        <span>{numPages ? `${numPages} page${numPages > 1 ? 's' : ''}` : 'Preparing preview…'}</span>
      </footer>
    </section>
  );
};

export default PdfFragment;
