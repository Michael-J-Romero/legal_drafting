import { PDFDocument } from 'pdf-lib';
import type { Fragment, MarkdownFragment, PdfFragment } from './fragments';

export type PdfAssemblyRequest = {
  fragments: Fragment[];
};

export type PdfAssemblyResult = {
  document: PDFDocument;
};

/**
 * Builds a PDF-Lib document by merging raw PDF fragments and reserved slots for markdown fragments.
 * Markdown fragments should be rendered to PDF before calling this helper in production.
 */
export async function assemblePdf({ fragments }: PdfAssemblyRequest): Promise<PdfAssemblyResult> {
  const document = await PDFDocument.create();

  for (const fragment of fragments) {
    if (isPdf(fragment)) {
      const bytes = await fetchPdfBytes(fragment.src);
      if (!bytes) {
        continue;
      }
      const source = await PDFDocument.load(bytes);
      const copiedPages = await document.copyPages(source, source.getPageIndices());
      copiedPages.forEach((page) => document.addPage(page));
    }

    if (isMarkdown(fragment)) {
      // Placeholder: Render markdown to PDF first, then embed.
      // For now we simply create a blank page to maintain ordering during experiments.
      document.addPage();
    }
  }

  return { document };
}

async function fetchPdfBytes(src: string): Promise<Uint8Array | undefined> {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      return undefined;
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.warn('Failed to load PDF fragment', error);
    return undefined;
  }
}

function isMarkdown(fragment: Fragment): fragment is MarkdownFragment {
  return fragment.type === 'markdown';
}

function isPdf(fragment: Fragment): fragment is PdfFragment {
  return fragment.type === 'pdf';
}
