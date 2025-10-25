'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useReactToPrint } from 'react-to-print';
import type { Fragment } from '../lib/fragments';
import { assemblePdf } from '../lib/pdfAssembler';

const PrintPreview = dynamic(() => import('../components/preview/PrintPreview').then((mod) => mod.PrintPreview), {
  ssr: false
});

const SAMPLE_FRAGMENTS: Fragment[] = [
  {
    id: 'intro',
    type: 'markdown',
    content: `# Draft Engagement Letter\n\nWelcome to the drafting workspace. This preview stitches together **markdown** and uploaded PDFs in the order you arrange them.\n\n- Works great with GitHub-flavored markdown\n- Keeps your formatting predictable\n- Ready to print or export`
  },
  {
    id: 'placeholder-pdf',
    type: 'pdf',
    src: '',
    title: 'Uploaded PDF will render here'
  },
  {
    id: 'terms',
    type: 'markdown',
    content: `## Terms Snapshot\n\n1. Provide a markdown fragment for each section.\n2. Upload signed exhibits as PDFs to preserve typography.\n3. Use the controls on the right to print or compile.`
  }
];

export default function HomePage() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function loadPagedJs() {
      if (typeof window === 'undefined') {
        return;
      }

      try {
        await import('pagedjs/dist/paged.polyfill.js');
        if (!cancelled) {
          setCompileStatus((status) => status || 'Paged.js polyfill ready for advanced pagination.');
        }
      } catch (error) {
        console.warn('Paged.js is optional and failed to initialize.', error);
      }
    }

    loadPagedJs();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    documentTitle: 'draft-preview'
  });

  const handleCompilePdf = async () => {
    setIsCompiling(true);
    setCompileStatus('Compiling merged PDF…');

    try {
      const result = await assemblePdf({ fragments: SAMPLE_FRAGMENTS });
      setCompileStatus(`Draft PDF ready in memory with ${result.document.getPageCount()} pages. Attach download logic next.`);
    } catch (error) {
      console.error(error);
      setCompileStatus('Unable to compile PDF yet. Check console for details.');
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <main>
      <div className="preview-shell">
        <PrintPreview ref={previewRef} fragments={SAMPLE_FRAGMENTS} />
        <aside className="preview-toolbar">
          <h2>Preview Controls</h2>
          <button type="button" onClick={handlePrint}>
            Print / Save as PDF
          </button>
          <button type="button" onClick={handleCompilePdf} disabled={isCompiling}>
            {isCompiling ? 'Compiling…' : 'Compile High-Fidelity PDF'}
          </button>
          {compileStatus && <p>{compileStatus}</p>}
          <p>
            Want to add your own PDF? Provide a `src` pointing to a hosted document or one placed in `public/` once
            uploaded.
          </p>
        </aside>
      </div>
    </main>
  );
}
