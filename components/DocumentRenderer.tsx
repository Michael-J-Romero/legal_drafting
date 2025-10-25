'use client';

import { useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useReactToPrint } from 'react-to-print';
import MarkdownFragment from './MarkdownFragment';
import type { DocumentFragment } from '@/lib/types';

const PdfFragment = dynamic(() => import('./PdfFragment'), {
  ssr: false,
  loading: () => <div className="pdf-fragment">Loading PDF…</div>,
});

interface DocumentRendererProps {
  fragments: DocumentFragment[];
}

export default function DocumentRenderer({ fragments }: DocumentRendererProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);

  const orderedFragments = useMemo(
    () => fragments.sort((a, b) => a.id.localeCompare(b.id)),
    [fragments],
  );

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    documentTitle: 'legal-drafting-preview',
  });

  const handleRefreshPaged = useCallback(async () => {
    try {
      const pagedModule = await import('pagedjs');
      const Previewer = (pagedModule as typeof import('pagedjs')).Previewer ??
        (pagedModule as typeof import('pagedjs')).default?.Previewer;

      if (Previewer && previewRef.current) {
        const previewer = new Previewer();
        await previewer.preview(previewRef.current, [], previewRef.current);
      }
    } catch (error) {
      console.warn('Paged.js preview is optional and failed to initialize.', error);
    }
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <div className="print-controls">
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
        >
          Print preview
        </button>
        <button
          type="button"
          onClick={handleRefreshPaged}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Refresh pagination
        </button>
      </div>

      <div ref={previewRef} className="print-container">
        {orderedFragments.map((fragment) => (
          <article key={fragment.id} className="print-preview-page">
            {fragment.type === 'markdown' ? (
              <MarkdownFragment content={fragment.content} />
            ) : (
              <PdfFragment fragment={fragment} />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
