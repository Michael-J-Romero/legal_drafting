'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownFragmentProps {
  content: string;
}

export default function MarkdownFragment({ content }: MarkdownFragmentProps) {
  return (
    <div className="markdown-fragment">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
