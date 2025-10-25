"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarkdownFragment } from "@/types/content";

interface MarkdownFragmentProps {
  fragment: MarkdownFragment;
}

export default function MarkdownFragmentView({ fragment }: MarkdownFragmentProps) {
  return (
    <article className="markdown-fragment">
      {fragment.label ? <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "#2563eb" }}>{fragment.label}</p> : null}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </article>
  );
}
