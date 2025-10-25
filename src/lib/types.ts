export type MarkdownFragment = {
  id: string;
  kind: "markdown";
  /** Markdown content to render */
  content: string;
};

export type PdfFragment = {
  id: string;
  kind: "pdf";
  /** URL or path to the PDF document */
  content: string;
  pageRange?: [number, number];
};

export type DocumentFragment = MarkdownFragment | PdfFragment;
