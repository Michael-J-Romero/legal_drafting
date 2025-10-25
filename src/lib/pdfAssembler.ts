import { PDFDocument } from 'pdf-lib';
import type { DocumentFragment, MarkdownFragment, PdfFragment } from '@/types/document';

/**
 * Placeholder for a high-fidelity PDF compilation pipeline. This function shows
 * how pdf-lib could be used to merge pre-rendered Markdown pages with existing
 * PDF fragments. The Markdown to PDF rendering step is left as future work.
 */
export const assemblePdf = async (fragments: DocumentFragment[]): Promise<Uint8Array> => {
  const target = await PDFDocument.create();

  for (const fragment of fragments) {
    if (fragment.kind === 'pdf') {
      await appendPdfFragment(target, fragment);
    }

    if (fragment.kind === 'markdown') {
      await appendMarkdownFragment(target, fragment);
    }
  }

  return target.save();
};

const appendPdfFragment = async (target: PDFDocument, fragment: PdfFragment) => {
  const source = await PDFDocument.load(await fetchBinary(fragment.src));
  const pages = await target.copyPages(source, source.getPageIndices());

  pages.forEach((page) => {
    target.addPage(page);
  });
};

const appendMarkdownFragment = async (target: PDFDocument, fragment: MarkdownFragment) => {
  console.info('Markdown fragment rendering not implemented yet', fragment.id);
  // Future work: render Markdown to PDF (e.g., via @react-pdf/renderer or a
  // headless browser) and embed the resulting pages here.
  return target;
};

const fetchBinary = async (src: string) => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF fragment: ${response.statusText}`);
  }

  return response.arrayBuffer();
};
