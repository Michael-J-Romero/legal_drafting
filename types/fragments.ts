export interface MarkdownFragment {
  id: string;
  type: 'markdown';
  content: string;
}

export interface PdfFragment {
  id: string;
  type: 'pdf';
  src: string;
  title?: string;
}

export type Fragment = MarkdownFragment | PdfFragment;
