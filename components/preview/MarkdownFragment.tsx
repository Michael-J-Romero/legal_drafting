'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MarkdownFragment as MarkdownFragmentType } from '@/types/fragments';

type Props = {
  fragment: MarkdownFragmentType;
};

const MarkdownFragment: React.FC<Props> = ({ fragment }) => {
  return (
    <section className="markdown-fragment" aria-label={fragment.label ?? 'Markdown fragment'}>
      {fragment.label ? <h2>{fragment.label}</h2> : null}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </section>
  );
};

export default MarkdownFragment;
