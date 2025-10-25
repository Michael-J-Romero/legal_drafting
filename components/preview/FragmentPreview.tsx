"use client";

import React, { forwardRef } from "react";
import dynamic from "next/dynamic";
import MarkdownFragment from "@/components/markdown/MarkdownFragment";
import type { DocumentFragment } from "@/types/fragments";

const PdfFragment = dynamic(() => import("@/components/pdf/PdfFragment"), {
  ssr: false,
  loading: () => <p>Preparing PDF preview…</p>,
});

interface FragmentPreviewProps {
  fragments: DocumentFragment[];
}

const FragmentPreview = forwardRef<HTMLDivElement, FragmentPreviewProps>(
  ({ fragments }, ref) => {
    return (
      <div className="preview-surface" ref={ref}>
        {fragments.map((fragment) => {
          if (fragment.kind === "markdown") {
            return <MarkdownFragment key={fragment.id} fragment={fragment} />;
          }

          if (fragment.kind === "pdf") {
            return <PdfFragment key={fragment.id} fragment={fragment} />;
          }

          return null;
        })}
      </div>
    );
  }
);

FragmentPreview.displayName = "FragmentPreview";

export default FragmentPreview;
