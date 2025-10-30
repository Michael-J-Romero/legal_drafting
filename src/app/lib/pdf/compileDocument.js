import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { idbGetPdf } from '../pdfStorage';
import {
  appendMarkdownFragment as appendMarkdownFragmentPdf,
  appendPdfFragment as appendPdfFragmentPdf,
  LETTER_WIDTH,
  appendExhibitIndex,
  appendExhibitCover,
} from './generate';
import { groupExhibits, buildIndexEntries } from '../exhibits';
import { base64ToUint8Array } from '../utils/base64';

async function resolvePdfBytes(fragment) {
  let bytes = null;
  if (fragment.data) {
    bytes = base64ToUint8Array(fragment.data);
  }
  if (!bytes && fragment.fileId) {
    const fromIdb = await idbGetPdf(fragment.fileId);
    bytes = fromIdb ? new Uint8Array(fromIdb) : null;
  }
  return bytes;
}

async function appendExhibitGroup(pdfDoc, group, captions) {
  const { parent, children, letter } = group;
  const parentData = parent?.data;
  const hasChildren = children?.length > 0;

  if (!hasChildren) {
    const parentType = (parentData?.type || '').toLowerCase();
    const mimeType = parentData?.mimeType || '';
    if (parentType === 'pdf' || mimeType.startsWith('application/pdf')) {
      const bytes = await resolvePdfBytes(parentData);
      if (bytes) await appendPdfFragmentPdf(pdfDoc, bytes);
    } else if (parentType === 'image' || mimeType.startsWith('image/')) {
      const titleLine = `Exhibit ${letter.toUpperCase()} - ${parentData?.title || parentData?.name || ''}`;
      const captionsForCover = [...captions];
      await appendExhibitCover(pdfDoc, captionsForCover, parentData?.description || '', titleLine);
      const bytes = await resolvePdfBytes(parentData);
      if (bytes) {
        try {
          const img = mimeType.includes('png')
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);
          const page = pdfDoc.addPage([LETTER_WIDTH, 792]);
          const MARGIN = 72;
          const maxWidth = LETTER_WIDTH - 2 * MARGIN;
          const maxHeight = 792 - 2 * MARGIN;
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
          const width = img.width * scale;
          const height = img.height * scale;
          const x = (LETTER_WIDTH - width) / 2;
          const y = (792 - height) / 2;
          page.drawImage(img, { x, y, width, height });
        } catch (error) {
          // Ignore invalid image
        }
      }
    }
  }

  for (let index = 0; index < (children || []).length; index += 1) {
    const child = children[index]?.data;
    const label = `${letter}${index + 1}`;
    const childType = (child?.type || '').toLowerCase();
    const mimeType = child?.mimeType || '';
    if (childType === 'pdf' || mimeType.startsWith('application/pdf')) {
      const bytes = await resolvePdfBytes(child);
      if (bytes) await appendPdfFragmentPdf(pdfDoc, bytes);
    } else if (childType === 'image' || mimeType.startsWith('image/')) {
      const titleLine = `Exhibit ${label.toUpperCase()} - ${child?.title || child?.name || ''}`;
      const captionsForCover = [...captions];
      await appendExhibitCover(pdfDoc, captionsForCover, child?.description || '', titleLine);
      const bytes = await resolvePdfBytes(child);
      if (bytes) {
        try {
          const img = mimeType.includes('png')
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);
          const page = pdfDoc.addPage([LETTER_WIDTH, 792]);
          const MARGIN = 72;
          const maxWidth = LETTER_WIDTH - 2 * MARGIN;
          const maxHeight = 792 - 2 * MARGIN;
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
          const width = img.width * scale;
          const height = img.height * scale;
          const x = (LETTER_WIDTH - width) / 2;
          const y = (792 - height) / 2;
          page.drawImage(img, { x, y, width, height });
        } catch (error) {
          // Ignore invalid image
        }
      }
    }
  }
}

export async function compileDocumentPdf({
  fragments,
  headingSettings,
  docDate,
  formatDisplayDate,
  showPageNumbers = true,
  compiledFileName,
}) {
  if (!Array.isArray(fragments) || fragments.length === 0) return null;

  const pdfDoc = await PDFDocument.create();

  for (const fragment of fragments) {
    if (!fragment) continue;
    if (fragment.type === 'markdown') {
      await appendMarkdownFragmentPdf(
        pdfDoc,
        fragment.content,
        headingSettings,
        fragment.title,
        docDate,
        formatDisplayDate,
        fragment.signatureType || 'default',
      );
    } else if (fragment.type === 'pdf') {
      const bytes = await resolvePdfBytes(fragment);
      if (bytes) await appendPdfFragmentPdf(pdfDoc, bytes);
    } else if (fragment.type === 'exhibits') {
      const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
      const captions = Array.isArray(fragment.captions) ? fragment.captions : [];
      const { groups } = groupExhibits(exhibits);
      const entries = buildIndexEntries(groups);
      await appendExhibitIndex(pdfDoc, captions, entries, 'Exhibit Index');
      for (const group of groups) {
        await appendExhibitGroup(pdfDoc, group, captions);
      }
    }
  }

  const totalPages = pdfDoc.getPageCount();
  if (showPageNumbers && totalPages > 0) {
    const footerFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    for (let index = 0; index < totalPages; index += 1) {
      const page = pdfDoc.getPage(index);
      const label = `Page ${index + 1} of ${totalPages}`;
      const size = 10;
      const textWidth = footerFont.widthOfTextAtSize(label, size);
      const x = (LETTER_WIDTH - textWidth) / 2;
      const y = 18;
      page.drawText(label, { x, y, size, font: footerFont, color: rgb(0.28, 0.32, 0.37) });
    }
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = compiledFileName;
  anchor.click();
  URL.revokeObjectURL(url);

  return url;
}
