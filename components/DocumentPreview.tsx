'use client';

import { useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useReactToPrint } from 'react-to-print';
import type { DocumentFragment, MarkdownFragment, PdfFragment } from '@/types/document';
import { CompilePdfButton } from './CompilePdfButton';
import styles from './document-preview.module.css';

const PdfFragmentRenderer = dynamic(() => import('./PdfFragmentRenderer'), {
  ssr: false
});

type DocumentPreviewProps = {
  fragments: DocumentFragment[];
};

const isMarkdownFragment = (fragment: DocumentFragment): fragment is MarkdownFragment =>
  fragment.type === 'markdown';

const isPdfFragment = (fragment: DocumentFragment): fragment is PdfFragment =>
  fragment.type === 'pdf';

export function DocumentPreview({ fragments }: DocumentPreviewProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current
  });

  const printableFragments = useMemo(() => fragments, [fragments]);

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Live Draft Preview</h1>
          <p className={styles.subtitle}>
            Combine Markdown documents and embedded PDFs into a single, printable flow.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.printButton} onClick={handlePrint}>
            Print / Save as PDF
          </button>
          <CompilePdfButton
            fragments={printableFragments}
            className={styles.compile}
            buttonClassName={styles.secondaryButton}
            statusClassName={styles.compileStatus}
          />
        </div>
      </header>

      <div className={styles.previewScroller}>
        <div className={styles.previewSurface} ref={previewRef}>
          {printableFragments.map((fragment) => {
            if (isMarkdownFragment(fragment)) {
              return (
                <article key={fragment.id} className={styles.fragment}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className={styles.markdown}>
                    {fragment.content}
                  </ReactMarkdown>
                </article>
              );
            }

            if (isPdfFragment(fragment)) {
              return (
                <article key={fragment.id} className={styles.fragment}>
                  <PdfFragmentRenderer fragment={fragment} />
                </article>
              );
            }

            return null;
          })}
        </div>
      </div>
    </section>
  );
}
