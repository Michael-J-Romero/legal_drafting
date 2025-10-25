'use client';

import React from 'react';
import MarkdownPreview from './MarkdownPreview';
import PdfPreview from './PdfPreview';
import type { Fragment } from './fragmentTypes';
import styles from './documentPreview.module.css';

export type DocumentPreviewProps = {
  fragments: Fragment[];
};

const DocumentPreview = React.forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ fragments }, ref) => {
    return (
      <div ref={ref} className={styles.previewStack}>
        {fragments.map((fragment) => {
          if (fragment.type === 'markdown') {
            return <MarkdownPreview key={fragment.id} fragment={fragment} />;
          }

          return <PdfPreview key={fragment.id} fragment={fragment} />;
        })}
      </div>
    );
  }
);

DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;
