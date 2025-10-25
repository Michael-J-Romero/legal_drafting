'use client';

import { useEffect, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PdfFragmentDefinition } from '@/lib/types';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfFragmentProps {
  fragment: PdfFragmentDefinition;
}

export default function PdfFragment({ fragment }: PdfFragmentProps) {
  const [pageCount, setPageCount] = useState(0);

  const file = useMemo(() => ({ url: fragment.src, withCredentials: fragment.withCredentials ?? false }), [fragment]);

  useEffect(() => {
    if (!fragment.src) {
      console.warn(`PDF fragment "${fragment.id}" is missing a source. Provide a URL or ArrayBuffer.`);
    }
  }, [fragment]);

  if (!fragment.src) {
    return (
      <div className="pdf-fragment p-6 text-sm text-slate-500">
        PDF source not provided yet. Drop a URL or binary stream to preview.
      </div>
    );
  }

  return (
    <div className="pdf-fragment">
      <Document
        file={file}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
        loading={<div className="p-6 text-sm text-slate-500">Loading PDF…</div>}
        error={<div className="p-6 text-sm text-red-500">Unable to load PDF fragment.</div>}
      >
        {Array.from({ length: pageCount }, (_, index) => (
          <Page key={index + 1} pageNumber={index + 1} width={793} renderAnnotationLayer renderTextLayer />
        ))}
      </Document>
    </div>
  );
}
