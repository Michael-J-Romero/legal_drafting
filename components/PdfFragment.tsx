'use client';

import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

import type { PdfFragment as PdfFragmentType } from '@/lib/documentTypes';

const WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfFragmentProps {
  fragment: PdfFragmentType;
}

export function PdfFragment({ fragment }: PdfFragmentProps) {
  const [numPages, setNumPages] = useState<number>();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions.workerSrc !== WORKER_SRC) {
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
    }
  }, []);

  return (
    <div className="pdf-fragment" data-fragment-id={fragment.id}>
      <h3 style={{ margin: 0 }}>{fragment.label ?? 'PDF fragment'}</h3>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <Document
          file={fragment.src}
          loading={<Placeholder message="Loading PDF preview…" />}
          onLoadError={(error) => {
            console.error(error);
            setLoadError(error.message);
          }}
          onSourceError={(error) => {
            console.error(error);
            setLoadError(error.message);
          }}
          onLoadSuccess={(data) => {
            setNumPages(data.numPages);
            setLoadError(null);
          }}
        >
          {Array.from({ length: numPages ?? 0 }, (_, index) => (
            <Page
              key={`page-${index + 1}`}
              pageNumber={index + 1}
              width={794}
              renderAnnotationLayer
              renderTextLayer
            />
          ))}
        </Document>
        {loadError ? (
          <div style={{ padding: '1rem', background: '#fef2f2', color: '#991b1b' }}>
            Unable to load PDF preview. Confirm that the file exists at <code>{fragment.src}</code>.
          </div>
        ) : null}
        {!numPages && !loadError ? (
          <div style={{ padding: '1rem', background: '#f8fafc', color: '#475569' }}>
            Provide a PDF at <code>{fragment.src}</code> to enable the preview.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Placeholder({ message }: { message: string }) {
  return (
    <div style={{ padding: '1.25rem', textAlign: 'center', color: '#475569' }}>
      <span>{message}</span>
    </div>
  );
}

export default PdfFragment;
