export type FragmentType = 'markdown' | 'pdf';

export interface BaseFragment<TType extends FragmentType = FragmentType> {
  id: string;
  type: TType;
  label?: string;
}

export interface MarkdownFragment extends BaseFragment<'markdown'> {
  content: string;
}

export interface PdfFragment extends BaseFragment<'pdf'> {
  /**
   * Source can be a relative path inside /public, a remote URL, or an ArrayBuffer encoded as a data URL.
   */
  src: string;
  /**
   * Provide a zero-based inclusive start and exclusive end page range to limit the view.
   */
  pageRange?: [number, number];
}

export type DocumentFragment = MarkdownFragment | PdfFragment;
