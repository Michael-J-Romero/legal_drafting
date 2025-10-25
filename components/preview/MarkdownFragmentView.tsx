'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MarkdownFragment } from '../../lib/fragments';

type MarkdownFragmentViewProps = {
  fragment: MarkdownFragment;
};

export function MarkdownFragmentView({ fragment }: MarkdownFragmentViewProps) {
  return (
    <section className="preview-page">
      <span className="fragment-meta">Markdown</span>
      <ReactMarkdown className="markdown-content" remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </section>
  );
}
