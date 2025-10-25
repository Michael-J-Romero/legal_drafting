export type MarkdownFragment = {
  id: string;
  type: 'markdown';
  content: string;
  label?: string;
};

export type PdfFragment = {
  id: string;
  type: 'pdf';
  /**
   * URL or path to the PDF asset. Keep remote URLs CORS-enabled.
   */
  source: string;
  label?: string;
};

export type PrintFragment = MarkdownFragment | PdfFragment;
