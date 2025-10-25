"use client";

import type { Fragment } from "@/lib/fragments";
import { MarkdownFragmentRenderer } from "./MarkdownFragment";
import { PdfFragmentRenderer } from "./PdfFragment";

export type FragmentRendererProps = {
  fragment: Fragment;
};

export function FragmentRenderer({ fragment }: FragmentRendererProps) {
  switch (fragment.kind) {
    case "markdown":
      return <MarkdownFragmentRenderer fragment={fragment} />;
    case "pdf":
      return <PdfFragmentRenderer fragment={fragment} />;
    default:
      return null;
  }
}
