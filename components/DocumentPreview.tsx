'use client';

import { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import type { Fragment } from '@/types/fragments';
import MarkdownFragment from './MarkdownFragment';
import PdfFragment from './PdfFragment';

export interface DocumentPreviewProps {
  fragments: Fragment[];
}

export default function DocumentPreview({ fragments }: DocumentPreviewProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [isPrinting, setPrinting] = useState(false);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    documentTitle: 'legal-drafting-preview',
    onBeforePrint: () => setPrinting(true),
    onAfterPrint: () => setPrinting(false),
  });

  return (
    <section>
      <div className="controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={handlePrint} type="button">
          Print / Save as PDF
        </button>
        {isPrinting ? <span>Preparing print preview…</span> : null}
      </div>
      <div className="preview-wrapper" ref={previewRef}>
        {fragments.map((fragment) => (
          <article key={fragment.id} className="preview-page">
            {fragment.type === 'markdown' ? (
              <MarkdownFragment fragment={fragment} />
            ) : (
              <PdfFragment fragment={fragment} />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
