"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarkdownFragment as MarkdownFragmentType } from "@/types/fragments";

interface MarkdownFragmentProps {
  fragment: MarkdownFragmentType;
}

const MarkdownFragment: React.FC<MarkdownFragmentProps> = ({ fragment }) => {
  return (
    <section className="markdown-fragment" aria-labelledby={`${fragment.id}-heading`}>
      {fragment.label ? <h2 id={`${fragment.id}-heading`}>{fragment.label}</h2> : null}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </section>
  );
};

export default MarkdownFragment;
