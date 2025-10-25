'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useReactToPrint } from 'react-to-print';
import type { DocumentFragment } from '@/types/document';

import MarkdownFragment from './MarkdownFragment';
const PdfFragment = dynamic(() => import('./PdfFragment'), { ssr: false });

type PrintPreviewProps = {
  fragments: DocumentFragment[];
  className?: string;
};

const PrintPreview: React.FC<PrintPreviewProps> = ({ fragments, className }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    pageStyle: `
      @page {
        margin: 1in;
      }
      body {
        -webkit-print-color-adjust: exact;
      }
    `,
  });

  const orderedFragments = useMemo(() => [...fragments], [fragments]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const pagedModule = await import('pagedjs');
        if (!isMounted) return;
        const Previewer =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (pagedModule as any).Previewer || (pagedModule as any).Paged?.Previewer;

        if (Previewer && containerRef.current) {
          const previewer = new Previewer();
          previewer.preview(containerRef.current);
        }
      } catch (error) {
        console.warn('Paged.js preview not initialised', error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ padding: '2rem', display: 'grid', gap: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Document Preview</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Paginated preview that mirrors the final printed or PDF output.
          </p>
        </div>
        <button type="button" onClick={handlePrint} style={{ padding: '0.75rem 1.5rem' }}>
          Print / Save as PDF
        </button>
      </header>

      <div ref={containerRef} className={className}>
        <div ref={printRef} className="print-preview-container">
          {orderedFragments.map((fragment) => {
            if (fragment.type === 'markdown') {
              return <MarkdownFragment key={fragment.id} fragment={fragment} />;
            }

            if (fragment.type === 'pdf') {
              return <PdfFragment key={fragment.id} fragment={fragment} />;
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
};

export default PrintPreview;
