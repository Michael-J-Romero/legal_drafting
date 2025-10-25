'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { FragmentPreview } from './components/FragmentPreview';
import { demoFragments } from '../lib/demoFragments';
import type { Fragment } from '../lib/fragmentTypes';

export default function HomePage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const fragments = useMemo<Fragment[]>(() => demoFragments, []);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    documentTitle: 'legal-drafting-preview'
  });

  useEffect(() => {
    let mounted = true;

    import('pagedjs')
      .then((module) => {
        if (!mounted) {
          return;
        }

        const paged = (module as unknown as { default?: unknown; Paged?: unknown })?.default ?? module;
        const Previewer = (paged as { Previewer?: unknown })?.Previewer;

        if (Previewer) {
          // Instantiate lazily later when pagination rules are needed.
        }
      })
      .catch((error) => {
        console.warn('Paged.js is optional and failed to load', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main>
      <section className="panel">
        <header className="panel__header">
          <div>
            <h1>Legal Drafting Preview</h1>
            <p className="panel__subtitle">
              Combine Markdown narratives and PDF exhibits into a single print-ready document.
            </p>
          </div>
          <div className="panel__actions">
            <button type="button" onClick={handlePrint} className="button">
              Print / Save as PDF
            </button>
          </div>
        </header>
        <p className="panel__hint">
          This starter focuses on preview scaffolding. Replace the demo fragments in <code>lib/demoFragments.ts</code>
          {' '}with your own content, and wire in pdf-lib when you are ready to produce compiled deliverables.
        </p>
      </section>

      <section className="preview">
        <h2 className="preview__title">Live preview</h2>
        <div className="preview__canvas" ref={previewRef}>
          <FragmentPreview fragments={fragments} />
        </div>
      </section>
    </main>
  );
}
