export type MarkdownFragment = {
  id: string;
  kind: 'markdown';
  title?: string;
  markdown: string;
};

export type PdfFragment = {
  id: string;
  kind: 'pdf';
  title?: string;
  src: string; // can be URL or data URI
};

export type Fragment = MarkdownFragment | PdfFragment;
