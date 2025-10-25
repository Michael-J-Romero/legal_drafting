export type MarkdownFragment = {
  id: string;
  kind: 'markdown';
  label?: string;
  content: string;
};

export type PdfFragment = {
  id: string;
  kind: 'pdf';
  label?: string;
  source: string;
};

export type Fragment = MarkdownFragment | PdfFragment;
