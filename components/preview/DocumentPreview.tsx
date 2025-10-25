"use client";

import { forwardRef } from "react";
import type { DocumentConfig } from "@/lib/fragments";
import { FragmentRenderer } from "./FragmentRenderer";

export type DocumentPreviewProps = {
  document: DocumentConfig;
};

export const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ document }, ref) => {
    return (
      <div className="print-surface" ref={ref}>
        <header>
          <h1>{document.title}</h1>
        </header>
        <div className="fragment-stack">
          {document.fragments.map((fragment) => (
            <FragmentRenderer key={fragment.id} fragment={fragment} />
          ))}
        </div>
      </div>
    );
  }
);

DocumentPreview.displayName = "DocumentPreview";
