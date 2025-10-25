'use client';

import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import type { PdfFragment as PdfFragmentType } from '@/types/fragments';

pdfjs.GlobalWorkerOptions.workerSrc =
  pdfjs.GlobalWorkerOptions.workerSrc ||
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export default function PdfFragment({ fragment }: { fragment: PdfFragmentType }) {
  const [numPages, setNumPages] = useState<number>();

  useEffect(() => {
    setNumPages(undefined);
  }, [fragment.src]);

  return (
    <div className="pdf-fragment" style={{ width: '100%' }}>
      <Document
        file={fragment.src}
        loading={<p>Loading PDF…</p>}
        error={<p>Unable to load the PDF fragment.</p>}
        onLoadSuccess={({ numPages: nextNumPages }) => setNumPages(nextNumPages)}
      >
        {Array.from(new Array(numPages || 0), (_el, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            width={Math.round(8.5 * 96) - 96}
            renderAnnotationLayer
            renderTextLayer
          />
        ))}
      </Document>
    </div>
  );
}
