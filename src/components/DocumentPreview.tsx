import React, { forwardRef } from 'react';
import dynamic from 'next/dynamic';
import MarkdownFragmentPreview from './MarkdownFragmentPreview';
import type { DocumentFragment } from '@/types/document';

const PdfFragmentPreview = dynamic(() => import('./PdfFragmentPreview'), {
  ssr: false,
  loading: () => <p>Loading PDF viewer…</p>,
});

type Props = {
  fragments: DocumentFragment[];
};

const DocumentPreview = forwardRef<HTMLDivElement, Props>(({ fragments }, ref) => {
  return (
    <div ref={ref} className="document-preview">
      {fragments.map((fragment) => {
        if (fragment.kind === 'markdown') {
          return <MarkdownFragmentPreview key={fragment.id} content={fragment.content} />;
        }

        if (fragment.kind === 'pdf') {
          return (
            <PdfFragmentPreview key={fragment.id} src={fragment.src} pageRange={fragment.pageRange} />
          );
        }

        return null;
      })}
    </div>
  );
});

DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;
