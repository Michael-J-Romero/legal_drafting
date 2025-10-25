'use client';

import React, { forwardRef } from 'react';

import type { DocumentFragment } from '@/lib/documentTypes';
import { isMarkdownFragment, isPdfFragment } from '@/lib/pdfAssembly';

import MarkdownFragment from './MarkdownFragment';
import PdfFragment from './PdfFragment';

export interface DocumentPreviewProps {
  fragments: DocumentFragment[];
}

export const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  function DocumentPreviewInner({ fragments }, ref) {
    return (
      <div ref={ref} className="print-target" role="region" aria-label="Document print preview">
        {fragments.map((fragment) => {
          if (isMarkdownFragment(fragment)) {
            return <MarkdownFragment key={fragment.id} fragment={fragment} />;
          }

          if (isPdfFragment(fragment)) {
            return <PdfFragment key={fragment.id} fragment={fragment} />;
          }

          return null;
        })}
      </div>
    );
  }
);

DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;
