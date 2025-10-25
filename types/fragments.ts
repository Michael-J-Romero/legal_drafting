export type MarkdownFragment = {
  id: string;
  kind: "markdown";
  content: string;
  label?: string;
};

export type PdfFragment = {
  id: string;
  kind: "pdf";
  /**
   * Source URL relative to the Next.js public directory or an absolute URL.
   */
  src: string;
  title?: string;
};

export type DocumentFragment = MarkdownFragment | PdfFragment;
