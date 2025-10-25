import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  content: string;
};

export const MarkdownFragmentPreview: React.FC<Props> = ({ content }) => {
  return (
    <article className="markdown-fragment">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
};

export default MarkdownFragmentPreview;
