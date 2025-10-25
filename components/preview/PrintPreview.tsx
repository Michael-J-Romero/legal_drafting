'use client';

import React, { forwardRef } from 'react';
import type { Fragment } from '../../lib/fragments';
import { MarkdownFragmentView } from './MarkdownFragmentView';
import { PdfFragmentView } from './PdfFragmentView';
import { isMarkdownFragment, isPdfFragment } from '../../lib/fragments';

type PrintPreviewProps = {
  fragments: Fragment[];
};

export const PrintPreview = forwardRef<HTMLDivElement, PrintPreviewProps>(function PrintPreview(
  { fragments },
  ref
) {
  return (
    <div className="preview-pages" ref={ref}>
      {fragments.map((fragment) => {
        if (isMarkdownFragment(fragment)) {
          return <MarkdownFragmentView key={fragment.id} fragment={fragment} />;
        }

        if (isPdfFragment(fragment)) {
          return <PdfFragmentView key={fragment.id} fragment={fragment} />;
        }

        return null;
      })}
    </div>
  );
});
