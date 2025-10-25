import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Fragment, MarkdownFragment, PdfFragment } from '../types/fragments';
import { markdownToPlainText } from './text';

async function embedMarkdownFragment(doc: PDFDocument, fragment: MarkdownFragment) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const lineHeight = fontSize * 1.4;
  const margin = 54;

  let page = doc.addPage();
  let { width, height } = page.getSize();
  let cursorY = height - margin;
  let line = '';

  const content = markdownToPlainText(fragment.content);
  const words = content.split(/\s+/).filter(Boolean);
  const maxWidth = width - margin * 2;

  const drawLine = (text: string) => {
    page.drawText(text, {
      x: margin,
      y: cursorY,
      size: fontSize,
      lineHeight,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  const ensureSpaceForLine = () => {
    if (cursorY <= margin) {
      page = doc.addPage();
      ({ width, height } = page.getSize());
      cursorY = height - margin;
    }
  };

  for (const word of words) {
    const testLine = line.length === 0 ? word : `${line} ${word}`;

    if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth) {
      ensureSpaceForLine();
      if (line.length > 0) {
        drawLine(line);
        cursorY -= lineHeight;
      }
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line.length > 0) {
    ensureSpaceForLine();
    drawLine(line);
  }
}

async function embedPdfFragment(doc: PDFDocument, fragment: PdfFragment) {
  const response = await fetch(fragment.src);
  const bytes = await response.arrayBuffer();
  const external = await PDFDocument.load(bytes);
  const pages = await doc.copyPages(external, external.getPageIndices());
  pages.forEach((page) => doc.addPage(page));
}

export async function compileFragmentsToPdf(fragments: Fragment[]): Promise<Blob> {
  const doc = await PDFDocument.create();

  for (const fragment of fragments) {
    if (fragment.type === 'markdown') {
      await embedMarkdownFragment(doc, fragment);
    } else {
      await embedPdfFragment(doc, fragment);
    }
  }

  const pdfBytes = await doc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
