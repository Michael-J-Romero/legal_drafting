import React, { forwardRef } from 'react';
import type { Fragment } from '../lib/types';
import { MarkdownFragment } from './MarkdownFragment';
import { PdfFragment } from './PdfFragment';
import '../styles/preview.css';

interface DocumentPreviewProps {
  fragments: Fragment[];
}

export const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ fragments }, ref) => (
    <div className="preview-shell" ref={ref}>
      {fragments.map((fragment) => (
        <section className="preview-section" key={fragment.id}>
          {fragment.title ? <header className="preview-heading">{fragment.title}</header> : null}
          {fragment.kind === 'markdown' ? (
            <MarkdownFragment fragment={fragment} />
          ) : (
            <PdfFragment fragment={fragment} />
          )}
        </section>
      ))}
    </div>
  ),
);

DocumentPreview.displayName = 'DocumentPreview';
