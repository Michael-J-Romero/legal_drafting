import { useCallback, useState } from 'react';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { Fragment, MarkdownFragment, PdfFragment } from '../lib/types';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const DEFAULT_MARGIN = 48;
const FONT_SIZE = 12;
const LINE_HEIGHT = FONT_SIZE * 1.35;

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/#+\s*/g, '')
    .replace(/\|/g, '')
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

async function embedMarkdown(pdfDoc: PDFDocument, fragment: MarkdownFragment) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - DEFAULT_MARGIN;

  const text = markdownToPlainText(fragment.markdown);
  const lines = wrapText(text, font, FONT_SIZE, A4_WIDTH - DEFAULT_MARGIN * 2);

  for (const line of lines) {
    if (y < DEFAULT_MARGIN) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      y = A4_HEIGHT - DEFAULT_MARGIN;
    }

    page.drawText(line, {
      x: DEFAULT_MARGIN,
      y,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
    y -= LINE_HEIGHT;
  }
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const potentialLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(potentialLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = potentialLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

async function embedPdf(pdfDoc: PDFDocument, fragment: PdfFragment) {
  const src = fragment.src;
  const data = src.startsWith('data:') ? dataUriToUint8Array(src) : await fetchArrayBuffer(src);
  const fragmentDoc = await PDFDocument.load(data);
  const copiedPages = await pdfDoc.copyPages(fragmentDoc, fragmentDoc.getPageIndices());
  copiedPages.forEach((page) => pdfDoc.addPage(page));
}

function dataUriToUint8Array(dataUri: string): Uint8Array {
  const [, base64] = dataUri.split(',');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function fetchArrayBuffer(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF fragment: ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export function useCompiledPdf() {
  const [isCompiling, setIsCompiling] = useState(false);

  const compile = useCallback(async (fragments: Fragment[]) => {
    setIsCompiling(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const fragment of fragments) {
        if (fragment.kind === 'markdown') {
          await embedMarkdown(pdfDoc, fragment);
        } else {
          await embedPdf(pdfDoc, fragment);
        }
      }

      const bytes = await pdfDoc.save();
      return new Blob([bytes], { type: 'application/pdf' });
    } finally {
      setIsCompiling(false);
    }
  }, []);

  return { compile, isCompiling };
}
