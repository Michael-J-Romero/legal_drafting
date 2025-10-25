import { PDFDocument } from 'pdf-lib';
import type { Fragment, PdfFragment } from '@/types/fragments';

export interface CompileOptions {
  fragments: Fragment[];
}

/**
 * Placeholder API for future high-fidelity PDF compilation.
 *
 * The intended flow:
 * 1. Render Markdown fragments to PDF pages (e.g. using @react-pdf/renderer or headless Chrome).
 * 2. Append existing PDF fragments losslessly by embedding their pages via pdf-lib.
 * 3. Return a merged document that mirrors the on-screen pagination.
 */
export async function compilePdfDocument({ fragments }: CompileOptions): Promise<PDFDocument> {
  const doc = await PDFDocument.create();

  // Future implementation will iterate through fragments, convert markdown to PDF pages,
  // and embed PDF fragments using `doc.copyPages`. For now we keep the scaffolding ready.
  const hasPdfFragment = fragments.some((fragment) => fragment.type === 'pdf');
  if (hasPdfFragment) {
    console.warn('PDF compilation is not implemented yet. Fragments will be ignored.');
  }

  return doc;
}

export function isPdfFragment(fragment: Fragment): fragment is PdfFragment {
  return fragment.type === 'pdf';
}
