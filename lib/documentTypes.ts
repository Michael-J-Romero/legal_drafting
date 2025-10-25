export type MarkdownFragment = {
  id: string;
  type: 'markdown';
  content: string;
};

export type PdfFragment = {
  id: string;
  type: 'pdf';
  /**
   * Relative or absolute URL to the PDF source.
   * Local files should be placed under the public directory.
   */
  src: string;
  /**
   * Optional alt text for screen readers.
   */
  label?: string;
};

export type DocumentFragment = MarkdownFragment | PdfFragment;

export interface DocumentAssembly {
  id: string;
  title: string;
  fragments: DocumentFragment[];
}
