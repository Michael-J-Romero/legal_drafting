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

export function isMarkdownFragment(fragment: Fragment): fragment is MarkdownFragment {
  return fragment.type === 'markdown';
}

export function isPdfFragment(fragment: Fragment): fragment is PdfFragment {
  return fragment.type === 'pdf';
}
