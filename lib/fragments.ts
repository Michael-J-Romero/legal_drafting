export type MarkdownFragment = {
  id: string;
  type: 'markdown';
  content: string;
};

export type PdfFragment = {
  id: string;
  type: 'pdf';
  src: string;
  title?: string;
};

export type Fragment = MarkdownFragment | PdfFragment;

export const isMarkdownFragment = (fragment: Fragment): fragment is MarkdownFragment =>
  fragment.type === 'markdown';

export const isPdfFragment = (fragment: Fragment): fragment is PdfFragment => fragment.type === 'pdf';
