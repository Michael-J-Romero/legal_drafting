export type MarkdownFragment = {
  id: string;
  type: 'markdown';
  content: string;
};

export type PdfFragment = {
  id: string;
  type: 'pdf';
  /**
   * Can be a URL, object URL, or base64 string recognized by react-pdf.
   */
  src: string;
  /**
   * Optional friendly label for download lists and UI.
   */
  label?: string;
};

export type Fragment = MarkdownFragment | PdfFragment;
