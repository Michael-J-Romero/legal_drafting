'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MarkdownFragment as MarkdownFragmentType } from '@/types/fragments';

export default function MarkdownFragment({ fragment }: { fragment: MarkdownFragmentType }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </div>
  );
}
