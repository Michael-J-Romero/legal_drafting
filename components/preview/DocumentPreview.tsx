"use client";

import MarkdownFragmentView from "@/components/preview/MarkdownFragment";
import PdfFragmentView from "@/components/preview/PdfFragment";
import type { ContentFragment } from "@/types/content";
import { isMarkdownFragment, isPdfFragment } from "@/types/content";

interface DocumentPreviewProps {
  fragments: ContentFragment[];
}

export default function DocumentPreview({ fragments }: DocumentPreviewProps) {
  return (
    <div>
      {fragments.map((fragment) => (
        <section key={fragment.id} className="preview-page">
          {isMarkdownFragment(fragment) ? (
            <MarkdownFragmentView fragment={fragment} />
          ) : null}
          {isPdfFragment(fragment) ? <PdfFragmentView fragment={fragment} /> : null}
        </section>
      ))}
    </div>
  );
}
