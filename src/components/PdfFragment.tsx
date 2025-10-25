import React, { useState } from 'react';
import { Document, Page } from 'react-pdf';
import type { PdfFragment as PdfFragmentType } from '../lib/types';
import '../styles/pdf.css';

interface PdfFragmentProps {
  fragment: PdfFragmentType;
}

export function PdfFragment({ fragment }: PdfFragmentProps) {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="pdf-fragment">
      <Document
        file={fragment.src}
        onLoadSuccess={({ numPages: loadedPages }) => {
          setNumPages(loadedPages);
          setError(null);
        }}
        onLoadError={(loadError) => setError(loadError.message)}
        loading={<div className="pdf-placeholder">Loading PDF…</div>}
        error={<div className="pdf-placeholder">Failed to load PDF.</div>}
        options={{ cMapUrl: undefined, cMapPacked: false }}
      >
        {Array.from({ length: numPages }, (_, index) => (
          <Page
            key={`${fragment.id}-page-${index + 1}`}
            pageNumber={index + 1}
            width={720}
            renderTextLayer
            renderAnnotationLayer
          />
        ))}
      </Document>
      {error ? <p className="pdf-error">{error}</p> : null}
    </div>
  );
}
