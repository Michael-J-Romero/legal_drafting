export type MarkdownFragment = {
  id: string;
  type: "markdown";
  label?: string;
  content: string;
};

export type PdfFragment = {
  id: string;
  type: "pdf";
  label?: string;
  src: string;
  note?: string;
};

export type ContentFragment = MarkdownFragment | PdfFragment;

export function isMarkdownFragment(fragment: ContentFragment): fragment is MarkdownFragment {
  return fragment.type === "markdown";
}

export function isPdfFragment(fragment: ContentFragment): fragment is PdfFragment {
  return fragment.type === "pdf";
}
