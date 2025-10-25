import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MarkdownFragment as MarkdownFragmentType } from '../lib/types';

interface MarkdownFragmentProps {
  fragment: MarkdownFragmentType;
}

export function MarkdownFragment({ fragment }: MarkdownFragmentProps) {
  return (
    <article className="markdown-fragment">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.markdown}</ReactMarkdown>
    </article>
  );
}
