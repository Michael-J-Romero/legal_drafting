'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import styles from './pdfPreview.module.css';
import type { PdfFragment } from './fragmentTypes';

const Document = dynamic(async () => (await import('react-pdf')).Document, {
  ssr: false
});
const Page = dynamic(async () => (await import('react-pdf')).Page, {
  ssr: false
});

export type PdfPreviewProps = {
  fragment: PdfFragment;
};

const PdfPreview: React.FC<PdfPreviewProps> = ({ fragment }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void import('react-pdf').then(({ pdfjs }) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    });
  }, []);

  return (
    <section className={styles.pdfCard} data-fragment-id={fragment.id}>
      {errorMessage ? (
        <div className={styles.placeholder}>{errorMessage}</div>
      ) : (
        <React.Suspense fallback={<div className={styles.placeholder}>Loading PDF…</div>}>
          <Document
            file={fragment.src}
            loading={<div className={styles.placeholder}>Loading PDF…</div>}
            onLoadError={(error) => setErrorMessage(error.message)}
          >
            <Page
              pageNumber={1}
              width={600}
              renderAnnotationLayer={false}
              renderTextLayer
            />
          </Document>
        </React.Suspense>
      )}
    </section>
  );
};

export default PdfPreview;
