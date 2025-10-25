import React, { useCallback, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PdfFragment } from '../types/fragments';
import './PdfPage.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type PdfPageProps = {
  fragment: PdfFragment;
};

const PdfPage: React.FC<PdfPageProps> = ({ fragment }) => {
  const [numPages, setNumPages] = useState(0);

  const onDocumentLoad = useCallback((payload: { numPages: number }) => {
    setNumPages(payload.numPages);
  }, []);

  return (
    <div className="pdf-fragment" data-fragment-id={fragment.id}>
      <Document file={fragment.src} onLoadSuccess={onDocumentLoad} loading={<div className="pdf-loading">Loading PDF…</div>}>
        {Array.from({ length: numPages }, (_, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            renderTextLayer
            renderAnnotationLayer
            width={816}
          />
        ))}
      </Document>
    </div>
  );
};

export default PdfPage;
