import React, { forwardRef } from 'react';
import type { Fragment } from '../types/fragments';
import MarkdownPage from './MarkdownPage';
import PdfPage from './PdfPage';
import './FragmentPreview.css';

type FragmentPreviewProps = {
  fragments: Fragment[];
};

const FragmentPreview = forwardRef<HTMLDivElement, FragmentPreviewProps>(({ fragments }, ref) => {
  return (
    <section className="fragment-preview" ref={ref}>
      {fragments.map((fragment) => (
        <div className="fragment-wrapper" key={fragment.id}>
          {fragment.type === 'markdown' ? (
            <MarkdownPage fragment={fragment} />
          ) : (
            <PdfPage fragment={fragment} />
          )}
        </div>
      ))}
    </section>
  );
});

FragmentPreview.displayName = 'FragmentPreview';

export default FragmentPreview;
