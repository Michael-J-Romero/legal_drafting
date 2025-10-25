"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "@/styles/MarkdownFragment.module.css";
import type { MarkdownFragment as MarkdownFragmentType } from "@/lib/types";

type Props = {
  fragment: MarkdownFragmentType;
};

export function MarkdownFragment({ fragment }: Props) {
  return (
    <section className={styles.fragment} data-fragment-id={fragment.id}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fragment.content}</ReactMarkdown>
    </section>
  );
}
