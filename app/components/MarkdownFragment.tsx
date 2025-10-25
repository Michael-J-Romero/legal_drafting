'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MarkdownFragment as MarkdownFragmentType } from '../../lib/fragmentTypes';

type Props = {
  fragment: MarkdownFragmentType;
};

export function MarkdownFragment({ fragment }: Props) {
  return (
    <article className="markdown-fragment" data-fragment-id={fragment.id}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </article>
  );
}
