import type { DocumentAssembly, DocumentFragment } from './documentTypes';

/**
 * Placeholder implementation for high-fidelity PDF compilation.
 *
 * The final version should:
 *  - Fetch and merge existing PDF fragments using pdf-lib.
 *  - Render markdown fragments to PDF (e.g. via headless browser or server renderer)
 *    and insert those pages into the assembled document.
 *
 * For now we expose the API surface so that downstream consumers can wire the
 * function into UI flows without changing their code once the implementation lands.
 */
export async function assemblePdf(_assembly: DocumentAssembly): Promise<Uint8Array> {
  throw new Error('assemblePdf is not implemented yet. Provide a pdf-lib integration here.');
}

export function isPdfFragment(fragment: DocumentFragment): fragment is Extract<DocumentFragment, { type: 'pdf' }> {
  return fragment.type === 'pdf';
}

export function isMarkdownFragment(
  fragment: DocumentFragment
): fragment is Extract<DocumentFragment, { type: 'markdown' }> {
  return fragment.type === 'markdown';
}
