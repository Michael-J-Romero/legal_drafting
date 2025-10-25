import { PDFDocument } from 'pdf-lib';
import type { Fragment, MarkdownFragment, PdfFragment } from '@/app/components/fragmentTypes';

export type PdfAssemblyResult = {
  document: PDFDocument;
  metadata: {
    totalPages: number;
  };
};

/**
 * Assembles a unified PDF by merging existing PDF fragments and rendering
 * Markdown fragments as new pages. Rendering Markdown to PDF is not yet
 * implemented; instead we include placeholders to be filled in later.
 */
export async function assemblePdf(fragments: Fragment[]): Promise<PdfAssemblyResult> {
  const doc = await PDFDocument.create();

  for (const fragment of fragments) {
    if (fragment.type === 'pdf') {
      await appendPdfFragment(doc, fragment);
    } else {
      await appendMarkdownPlaceholder(doc, fragment);
    }
  }

  return {
    document: doc,
    metadata: {
      totalPages: doc.getPageCount()
    }
  };
}

async function appendPdfFragment(doc: PDFDocument, fragment: PdfFragment) {
  try {
    const existingBytes = await fetch(fragment.src).then((res) => res.arrayBuffer());
    const donor = await PDFDocument.load(existingBytes);
    const copiedPages = await doc.copyPages(donor, donor.getPageIndices());
    copiedPages.forEach((page) => doc.addPage(page));
  } catch (error) {
    console.warn(`Failed to append PDF fragment ${fragment.id}:`, error);
  }
}

async function appendMarkdownPlaceholder(doc: PDFDocument, fragment: MarkdownFragment) {
  const page = doc.addPage();
  const { width, height } = page.getSize();
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: undefined,
    color: undefined
  });
  page.drawText(`Markdown fragment ${fragment.id} placeholder`, {
    x: 48,
    y: height / 2,
    size: 18
  });
}
