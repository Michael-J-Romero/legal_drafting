'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { MarkdownFragment as MarkdownFragmentType } from '@/lib/documentTypes';

interface MarkdownFragmentProps {
  fragment: MarkdownFragmentType;
}

const components = {
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <table {...props} style={{ borderCollapse: 'collapse', width: '100%' }} />
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      {...props}
      style={{
        border: '1px solid #d1d5db',
        padding: '0.5rem',
        textAlign: 'left',
        background: '#f9fafb'
      }}
    />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td
      {...props}
      style={{
        border: '1px solid #e5e7eb',
        padding: '0.5rem',
        verticalAlign: 'top'
      }}
    />
  )
};

export function MarkdownFragment({ fragment }: MarkdownFragmentProps) {
  return (
    <div className="markdown-fragment" data-fragment-id={fragment.id}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {fragment.content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownFragment;
