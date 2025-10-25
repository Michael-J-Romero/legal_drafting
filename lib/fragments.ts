export type MarkdownFragment = {
  id: string;
  kind: "markdown";
  content: string;
};

export type PdfFragment = {
  id: string;
  kind: "pdf";
  /**
   * Path or URL to a PDF document. For local assets place them under public/.
   */
  src: string;
  /** Optional zero-based page indexes to include. */
  pages?: number[];
  /** Human-friendly label shown in the sidebar. */
  label?: string;
};

export type Fragment = MarkdownFragment | PdfFragment;

export type DocumentConfig = {
  id: string;
  title: string;
  fragments: Fragment[];
};
