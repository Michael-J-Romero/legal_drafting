export type MarkdownFragment = {
  id: string;
  kind: 'markdown';
  content: string;
};

export type PdfFragment = {
  id: string;
  kind: 'pdf';
  src: string;
  pageRange?: [number, number];
};

export type DocumentFragment = MarkdownFragment | PdfFragment;
