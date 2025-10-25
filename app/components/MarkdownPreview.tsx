'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './markdownPreview.module.css';
import type { MarkdownFragment } from './fragmentTypes';

export type MarkdownPreviewProps = {
  fragment: MarkdownFragment;
};

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ fragment }) => {
  return (
    <article className={styles.markdownCard} data-fragment-id={fragment.id}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </article>
  );
};

export default MarkdownPreview;
