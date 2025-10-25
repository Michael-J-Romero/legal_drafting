import { PDFDocument } from 'pdf-lib';
import type { DocumentFragment, PdfFragmentDefinition } from './types';

export interface CompileOptions {
  onProgress?: (completed: number, total: number) => void;
}

export async function compileToSinglePdf(
  fragments: DocumentFragment[],
  options: CompileOptions = {},
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let processed = 0;

  for (const fragment of fragments) {
    processed += 1;

    if (fragment.type === 'pdf') {
      await appendPdfFragment(pdfDoc, fragment);
    } else {
      await appendMarkdownFragment(pdfDoc, fragment);
    }

    options.onProgress?.(processed, fragments.length);
  }

  return pdfDoc.save();
}

async function appendPdfFragment(pdfDoc: PDFDocument, fragment: PdfFragmentDefinition) {
  if (!fragment.src && !fragment.data) {
    console.warn(`PDF fragment "${fragment.id}" is missing both src and data.`);
    return;
  }

  const sourceBytes = fragment.data ?? (await fetch(fragment.src!).then((res) => res.arrayBuffer()));
  const donorPdf = await PDFDocument.load(sourceBytes);
  const copiedPages = await pdfDoc.copyPages(donorPdf, donorPdf.getPageIndices());
  copiedPages.forEach((page) => pdfDoc.addPage(page));
}

async function appendMarkdownFragment(_pdfDoc: PDFDocument, fragment: DocumentFragment) {
  console.info(
    `Markdown fragment "${fragment.id}" is queued for rendering. Implement HTML-to-PDF conversion before shipping.`,
  );
}
