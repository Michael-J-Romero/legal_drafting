export type MarkdownFragment = {
  id: string;
  kind: "markdown";
  label?: string;
  content: string;
};

export type PdfFragment = {
  id: string;
  kind: "pdf";
  label?: string;
  /**
   * URL or static asset path that points to a PDF file.
   * This will typically resolve to a Next.js static asset in /public or a remote URL.
   */
  src: string;
  /**
   * Optional zero-based page indexes to include. If omitted all pages are rendered.
   */
  pages?: number[];
};

export type DocumentFragment = MarkdownFragment | PdfFragment;

export function isMarkdown(fragment: DocumentFragment): fragment is MarkdownFragment {
  return fragment.kind === "markdown";
}

export function isPdf(fragment: DocumentFragment): fragment is PdfFragment {
  return fragment.kind === "pdf";
}
