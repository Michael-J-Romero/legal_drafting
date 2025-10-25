import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MarkdownFragment } from '../types/fragments';
import './MarkdownPage.css';

type MarkdownPageProps = {
  fragment: MarkdownFragment;
};

const MarkdownPage: React.FC<MarkdownPageProps> = ({ fragment }) => {
  return (
    <article className="markdown-page" data-fragment-id={fragment.id}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </article>
  );
};

export default MarkdownPage;
