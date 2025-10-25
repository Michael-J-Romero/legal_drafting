// pdf-lib will be used here once the composition workflow is implemented.
// import { PDFDocument } from 'pdf-lib';
import type { Fragment } from './fragmentTypes';

export type PdfCompositionResult = {
  pdfBytes: Uint8Array;
  pageCount: number;
};

/**
 * Placeholder composition pipeline. Replace with project-specific merging logic
 * once Markdown pages are rendered to PDF canvases.
 */
export async function composePdfFromFragments(_fragments: Fragment[]): Promise<PdfCompositionResult> {
  throw new Error('PDF composition is not implemented. Wire up pdf-lib when ready.');
}
