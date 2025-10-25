import { PDFDocument } from 'pdf-lib';
import type { PrintFragment } from '@/types/fragments';

/**
 * Scaffold helper to merge Markdown and PDF fragments into a single PDF.
 *
 * The implementation intentionally focuses on setting the stage for future
 * enhancements. For now we create an empty PDF document so that consumers can
 * connect additional rendering logic later (e.g. rasterising Markdown pages to
 * PDF and embedding existing PDF pages).
 */
export const assemblePdfFromFragments = async (
  fragments: PrintFragment[],
): Promise<Uint8Array> => {
  const result = await PDFDocument.create();

  // TODO: Merge PDF fragments via `PDFDocument.load` and insert Markdown pages
  // once the rendering pipeline is ready. Keeping the function async ensures it
  // already matches the signature required for more advanced workflows.
  fragments.forEach((fragment) => {
    if (fragment.type === 'markdown') {
      console.info(`Markdown fragment ${fragment.id} queued for future PDF rendering.`);
    }

    if (fragment.type === 'pdf') {
      console.info(`PDF fragment ${fragment.id} queued for future merging.`);
    }
  });

  return result.save();
};
