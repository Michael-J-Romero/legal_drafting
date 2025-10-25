import { PDFDocument } from 'pdf-lib';
import type { DocumentFragment } from '@/types/document';

/**
 * Placeholder merge helper that demonstrates how Markdown and PDF fragments could be
 * combined into a single, distributable PDF using pdf-lib.
 *
 * NOTE: The actual Markdown-to-PDF rendering pipeline is not implemented yet.
 */
export async function compileFragmentsToPdf(fragments: DocumentFragment[]): Promise<Uint8Array> {
  const output = await PDFDocument.create();

  for (const fragment of fragments) {
    if (fragment.type === 'pdf') {
      try {
        const pdfBytes = await fetch(fragment.src).then((response) => response.arrayBuffer());
        const source = await PDFDocument.load(pdfBytes);
        const copiedPages = await output.copyPages(source, source.getPageIndices());
        copiedPages.forEach((page) => output.addPage(page));
      } catch (error) {
        console.warn(`Skipping PDF fragment ${fragment.id}:`, error);
      }
    }

    if (fragment.type === 'markdown') {
      // Future work: render Markdown to PDF and embed it here.
      console.info(`Markdown fragment ${fragment.id} would be rendered to PDF in a later phase.`);
    }
  }

  return output.save();
}
