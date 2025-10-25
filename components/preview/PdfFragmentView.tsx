'use client';

import React, { useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PdfFragment } from '../../lib/fragments';

import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

type PdfFragmentViewProps = {
  fragment: PdfFragment;
};

const cdnWorker = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions.workerSrc !== cdnWorker) {
  pdfjs.GlobalWorkerOptions.workerSrc = cdnWorker;
}

export function PdfFragmentView({ fragment }: PdfFragmentViewProps) {
  const fileSource = useMemo(() => fragment.src, [fragment.src]);

  if (!fileSource) {
    return (
      <section className="preview-page">
        <span className="fragment-meta">PDF</span>
        <div className="pdf-placeholder">
          Add a PDF source path to preview the document here.
        </div>
      </section>
    );
  }

  return (
    <section className="preview-page">
      <span className="fragment-meta">PDF</span>
      <Document file={fileSource} loading={<div className="pdf-placeholder">Loading PDF…</div>}>
        <Page pageNumber={1} width={720} />
      </Document>
    </section>
  );
}
