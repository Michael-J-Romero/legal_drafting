"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarkdownFragment } from "@/lib/fragments";

export type MarkdownFragmentProps = {
  fragment: MarkdownFragment;
};

export function MarkdownFragmentRenderer({ fragment }: MarkdownFragmentProps) {
  return (
    <section className="markdown-fragment" data-fragment-id={fragment.id}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </section>
  );
}
