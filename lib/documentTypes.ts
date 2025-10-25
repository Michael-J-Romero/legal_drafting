export type MarkdownFragment = {
  id: string;
  type: "markdown";
  content: string;
};

export type PdfFragment = {
  id: string;
  type: "pdf";
  src: string;
  title?: string;
};

export type DocumentFragment = MarkdownFragment | PdfFragment;
