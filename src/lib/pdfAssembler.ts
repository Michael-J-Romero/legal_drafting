import { PDFDocument } from "pdf-lib";
import type { DocumentFragment, MarkdownFragment, PdfFragment } from "./fragments";

export type PdfAssemblyRequest = {
  fragments: DocumentFragment[];
  /**
   * Provide a loader that resolves a source identifier into a PDF byte array.
   * Consumers can map this to `fetch(src).then((res) => res.arrayBuffer())` or
   * load from the filesystem/server as needed.
   */
  loadPdfBytes: (src: string) => Promise<ArrayBuffer>;
  /**
   * Render markdown content into a PDF byte array. Implementation intentionally
   * left open for the host app to decide (e.g., using Playwright, headless Chrome,
   * or a server-side service).
   */
  renderMarkdownPage: (fragment: MarkdownFragment) => Promise<ArrayBuffer>;
};

export type PdfAssemblyResult = {
  /**
   * Bytes for the merged PDF document ready for download.
   */
  bytes: Uint8Array;
};

async function appendPdfFragment(target: PDFDocument, fragment: PdfFragment, loadPdfBytes: PdfAssemblyRequest["loadPdfBytes"]) {
  const sourceBytes = await loadPdfBytes(fragment.src);
  const sourceDoc = await PDFDocument.load(sourceBytes);
  const pageIndices = fragment.pages ?? sourceDoc.getPageIndices();
  const copiedPages = await target.copyPages(
    sourceDoc,
    pageIndices.map((page) => page)
  );

  copiedPages.forEach((page) => target.addPage(page));
}

async function appendMarkdownFragment(target: PDFDocument, fragment: MarkdownFragment, renderMarkdownPage: PdfAssemblyRequest["renderMarkdownPage"]) {
  const renderedBytes = await renderMarkdownPage(fragment);
  const renderedDoc = await PDFDocument.load(renderedBytes);
  const copiedPages = await target.copyPages(renderedDoc, renderedDoc.getPageIndices());

  copiedPages.forEach((page) => target.addPage(page));
}

export async function assemblePdf({ fragments, loadPdfBytes, renderMarkdownPage }: PdfAssemblyRequest): Promise<PdfAssemblyResult> {
  const doc = await PDFDocument.create();

  for (const fragment of fragments) {
    if (fragment.kind === "pdf") {
      await appendPdfFragment(doc, fragment, loadPdfBytes);
      continue;
    }

    await appendMarkdownFragment(doc, fragment, renderMarkdownPage);
  }

  const bytes = await doc.save();
  return { bytes };
}
