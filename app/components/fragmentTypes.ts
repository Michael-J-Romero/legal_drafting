export type MarkdownFragment = {
  id: string;
  type: 'markdown';
  content: string;
};

export type PdfFragment = {
  id: string;
  type: 'pdf';
  /**
   * URL or path to a PDF file that react-pdf can fetch. The actual file can
   * live in /public, an S3 bucket, etc.
   */
  src: string;
  /**
   * Optional byte range for future optimization (e.g., streaming partial PDFs).
   */
  byteRange?: {
    start: number;
    end: number;
  };
};

export type Fragment = MarkdownFragment | PdfFragment;
