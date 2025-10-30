import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { appendMarkdownFragment as appendMarkdownFragmentPdf, appendPdfFragment as appendPdfFragmentPdf, LETTER_WIDTH, appendExhibitIndex, appendExhibitCover } from '../lib/pdf/generate';
import { groupExhibits, buildIndexEntries } from '../lib/exhibits';
import { formatDisplayDate } from '../lib/date';
import { idbGetPdf } from '../lib/pdfStorage';
import { base64ToUint8Array } from '../utils/base64';

const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 72;

async function loadBytesFromSource(source) {
  if (!source) return null;
  let bytes = null;
  if (source.data) {
    bytes = base64ToUint8Array(source.data);
  }
  if (!bytes && source.fileId) {
    const fromIdb = await idbGetPdf(source.fileId);
    bytes = fromIdb ? new Uint8Array(fromIdb) : null;
  }
  return bytes;
}

async function appendExhibitGroupPages(pdfDoc, group, captions) {
  const parent = group.parent?.data;
  const hasChildren = group.children.length > 0;

  if (!parent) {
    return;
  }

  if (!hasChildren) {
    await appendSingleExhibit(pdfDoc, parent, group.letter, captions);
  } else {
    await appendSingleExhibit(pdfDoc, parent, group.letter, captions);
    for (let index = 0; index < group.children.length; index += 1) {
      const child = group.children[index].data;
      await appendSingleExhibit(pdfDoc, child, `${group.letter}${index + 1}`, captions);
    }
  }
}

async function appendSingleExhibit(pdfDoc, exhibit, label, captions) {
  if (!exhibit) {
    return;
  }

  const lowerType = (exhibit.type || '').toLowerCase();
  const mimeType = (exhibit.mimeType || '').toLowerCase();

  if (lowerType === 'pdf' || mimeType.startsWith('application/pdf')) {
    const bytes = await loadBytesFromSource(exhibit);
    if (bytes) {
      await appendPdfFragmentPdf(pdfDoc, bytes);
    }
    return;
  }

  if (lowerType === 'image' || mimeType.startsWith('image/')) {
    const titleLine = `Exhibit ${label.toUpperCase()} - ${exhibit.title || exhibit.name || ''}`;
    const captionsForCover = [...captions];
    await appendExhibitCover(pdfDoc, captionsForCover, exhibit.description || '', titleLine);

    const bytes = await loadBytesFromSource(exhibit);
    if (!bytes) {
      return;
    }

    try {
      const isPng = mimeType.includes('png');
      const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const page = pdfDoc.addPage([LETTER_WIDTH, PAGE_HEIGHT]);
      const maxWidth = LETTER_WIDTH - 2 * PAGE_MARGIN;
      const maxHeight = PAGE_HEIGHT - 2 * PAGE_MARGIN;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (LETTER_WIDTH - width) / 2;
      const y = (PAGE_HEIGHT - height) / 2;
      page.drawImage(image, { x, y, width, height });
    } catch (error) {
      // Ignore invalid image data
    }
  }
}

export async function compileDocumentPdf({ fragments, headingSettings, docDate, showPageNumbers }) {
  if (!Array.isArray(fragments) || fragments.length === 0) {
    return null;
  }

  const pdfDoc = await PDFDocument.create();

  for (const fragment of fragments) {
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
      continue;
    }

    if (fragment.type === 'pdf') {
      const bytes = await loadBytesFromSource(fragment);
      if (bytes) {
        await appendPdfFragmentPdf(pdfDoc, bytes);
      }
      continue;
    }

    if (fragment.type === 'exhibits') {
      const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
      const captions = Array.isArray(fragment.captions) ? fragment.captions : [];
      const { groups } = groupExhibits(exhibits);
      const entries = buildIndexEntries(groups);
      await appendExhibitIndex(pdfDoc, captions, entries, 'Exhibit Index');

      for (const group of groups) {
        // Include parent and child exhibits respecting covers
        await appendExhibitGroupPages(pdfDoc, group, captions);
      }
    }
  }

  const totalPages = pdfDoc.getPageCount();
  if (showPageNumbers !== false && totalPages > 0) {
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

  return pdfDoc.save();
}
