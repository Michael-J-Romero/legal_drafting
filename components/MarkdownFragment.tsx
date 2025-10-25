'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MarkdownFragment as MarkdownFragmentType } from '@/types/document';

interface MarkdownFragmentProps {
  fragment: MarkdownFragmentType;
}

const MarkdownFragment: React.FC<MarkdownFragmentProps> = ({ fragment }) => {
  return (
    <section data-fragment-id={fragment.id} aria-label={fragment.label ?? 'Markdown fragment'}>
      <article style={{ padding: '2rem', lineHeight: 1.6 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
      </article>
    </section>
  );
};

export default MarkdownFragment;
