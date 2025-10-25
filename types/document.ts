export type MarkdownFragment = {
  id: string;
  type: 'markdown';
  content: string;
};

export type PdfFragment = {
  id: string;
  type: 'pdf';
  /**
   * Source URL or data URI for the PDF content.
   */
  src: string;
  /**
   * Optional human friendly label used for debug output.
   */
  label?: string;
};

export type DocumentFragment = MarkdownFragment | PdfFragment;
