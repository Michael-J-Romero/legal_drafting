'use client';

import React, { forwardRef } from 'react';
import type { PrintFragment } from '@/types/fragments';
import MarkdownFragment from './MarkdownFragment';
import PdfFragment from './PdfFragment';

type Props = {
  fragments: PrintFragment[];
};

const DocumentPreview = forwardRef<HTMLDivElement, Props>(({ fragments }, ref) => (
  <div ref={ref} className="preview-page">
    {fragments.map((fragment) => {
      if (fragment.type === 'markdown') {
        return <MarkdownFragment key={fragment.id} fragment={fragment} />;
      }

      if (fragment.type === 'pdf') {
        return <PdfFragment key={fragment.id} fragment={fragment} />;
      }

      return null;
    })}
  </div>
));

DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;
