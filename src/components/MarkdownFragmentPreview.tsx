"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarkdownFragment } from "@/lib/fragments";

import styles from "./MarkdownFragmentPreview.module.css";

type Props = {
  fragment: MarkdownFragment;
};

export function MarkdownFragmentPreview({ fragment }: Props) {
  return (
    <section className={styles.container} aria-label={fragment.label ?? "Markdown fragment"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </section>
  );
}
