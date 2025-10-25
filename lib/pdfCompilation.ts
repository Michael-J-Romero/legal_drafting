import { PDFDocument } from 'pdf-lib';
import type { DocumentFragment, MarkdownFragment, PdfFragment } from '@/types/document';

export interface CompileOptions {
  fetchImplementation?: typeof fetch;
}

const isPdfFragment = (fragment: DocumentFragment): fragment is PdfFragment => fragment.type === 'pdf';
const isMarkdownFragment = (fragment: DocumentFragment): fragment is MarkdownFragment =>
  fragment.type === 'markdown';

export async function compileFragmentsToPdf(
  fragments: DocumentFragment[],
  options: CompileOptions = {},
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fetcher = options.fetchImplementation ?? fetch;

  for (const fragment of fragments) {
    if (isPdfFragment(fragment)) {
      await appendPdfFragment(pdfDoc, fragment, fetcher);
      continue;
    }

    if (isMarkdownFragment(fragment)) {
      // Placeholder for future Markdown-to-PDF conversion pipeline.
      await appendMarkdownFragment(pdfDoc, fragment);
    }
  }

  return pdfDoc.save();
}

async function appendPdfFragment(
  target: PDFDocument,
  fragment: PdfFragment,
  fetcher: typeof fetch,
): Promise<void> {
  const response = await fetcher(fragment.src);
  if (!response.ok) {
    throw new Error(`Unable to load PDF fragment: ${fragment.src}`);
  }

  const sourcePdf = await PDFDocument.load(await response.arrayBuffer());
  const copiedPages = await target.copyPages(
    sourcePdf,
    sourcePdf.getPageIndices().slice(
      fragment.pageRange?.[0] ?? 0,
      fragment.pageRange?.[1] ?? sourcePdf.getPageCount(),
    ),
  );

  copiedPages.forEach((page) => target.addPage(page));
}

async function appendMarkdownFragment(target: PDFDocument, fragment: MarkdownFragment): Promise<void> {
  // This is a stub implementation. A future enhancement can render Markdown to HTML,
  // then to PDF using a headless browser or canvas-based renderer before embedding.
  const page = target.addPage();
  page.drawText('[Markdown page placeholder]\n\n' + fragment.content.slice(0, 200), {
    x: 50,
    y: page.getHeight() - 50,
    size: 12,
  });
}
