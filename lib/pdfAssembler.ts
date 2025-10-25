import { PDFDocument } from "pdf-lib";
import type { DocumentFragment, PdfFragment } from "@/types/fragments";

export interface CompilationResult {
  bytes: Uint8Array;
  pdf: PDFDocument;
}

export interface CompilationOptions {
  title?: string;
  author?: string;
}

/**
 * Merge existing PDF fragments into a new PDF document.
 * Markdown fragments should be rendered to PDF pages before being passed in.
 */
export async function compilePdfFragments(
  fragments: DocumentFragment[],
  options: CompilationOptions = {}
): Promise<CompilationResult> {
  const document = await PDFDocument.create();

  if (options.title) {
    document.setTitle(options.title);
  }

  if (options.author) {
    document.setAuthor(options.author);
  }

  for (const fragment of fragments) {
    if (fragment.kind !== "pdf") {
      // Markdown handling is intentionally deferred until a rendering pipeline is implemented.
      // eslint-disable-next-line no-continue
      continue;
    }

    await appendPdfFragment(document, fragment);
  }

  const bytes = await document.save();
  return { bytes, pdf: document };
}

async function appendPdfFragment(document: PDFDocument, fragment: PdfFragment) {
  if (!fragment.src) return;

  // Placeholder implementation: callers should supply ArrayBuffer data.
  if (fragment.src.startsWith("http")) {
    throw new Error(
      "Remote PDF fetching is not yet implemented. Provide a fetched ArrayBuffer instead."
    );
  }

  throw new Error(
    "PDF merging requires binary data. Provide an ArrayBuffer source once wiring is completed."
  );
}
