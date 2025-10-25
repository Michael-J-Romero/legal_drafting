"use client";

import { forwardRef } from "react";
import type { DocumentFragment } from "@/lib/fragments";
import { isMarkdown, isPdf } from "@/lib/fragments";

import { MarkdownFragmentPreview } from "./MarkdownFragmentPreview";
import { PdfFragmentPreview } from "./PdfFragmentPreview";

import styles from "./FragmentPreview.module.css";

type Props = {
  fragments: DocumentFragment[];
};

export const FragmentPreview = forwardRef<HTMLDivElement, Props>(function FragmentPreview(
  { fragments },
  ref
) {
  return (
    <div className={styles.preview} ref={ref}>
      {fragments.map((fragment) => {
        if (isMarkdown(fragment)) {
          return <MarkdownFragmentPreview key={fragment.id} fragment={fragment} />;
        }

        if (isPdf(fragment)) {
          return <PdfFragmentPreview key={fragment.id} fragment={fragment} />;
        }

        return null;
      })}
    </div>
  );
});
