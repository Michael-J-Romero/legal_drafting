import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import removeMarkdown from 'remove-markdown';
import type { Fragment } from '../types/fragments';

type ProgressHandler = (message: string) => void;

const fetchPdfBytes = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

const wrapText = (
  text: string,
  maxWidth: number,
  fontSize: number,
  widthCalculator: (input: string, size: number) => number
): string[] => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    const testWidth = widthCalculator(testLine, fontSize);
    if (testWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      if (widthCalculator(word, fontSize) > maxWidth) {
        const characters = word.split('');
        let chunk = '';
        characters.forEach((character) => {
          const chunkTest = chunk + character;
          if (widthCalculator(chunkTest, fontSize) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = character;
          } else {
            chunk = chunkTest;
          }
        });
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
};

export const compileFragmentsToPdf = async (
  fragments: Fragment[],
  onProgress?: ProgressHandler
): Promise<Uint8Array> => {
  const document = await PDFDocument.create();

  for (const fragment of fragments) {
    onProgress?.(`Processing ${fragment.label ?? fragment.id}`);

    if (fragment.kind === 'markdown') {
      const font = await document.embedFont(StandardFonts.Helvetica);
      const fontSize = 12;
      const margin = 50;
      const initialPage = document.addPage();
      let page = initialPage;
      let { width, height } = page.getSize();
      const maxWidth = width - margin * 2;
      const lineHeight = fontSize * 1.2;
      const text = removeMarkdown(fragment.content);
      const lines = wrapText(text, maxWidth, fontSize, font.widthOfTextAtSize.bind(font));

      let cursorY = height - margin;
      lines.forEach((line) => {
        if (cursorY <= margin) {
          page = document.addPage();
          ({ width, height } = page.getSize());
          cursorY = height - margin;
        }
        page.drawText(line, {
          x: margin,
          y: cursorY,
          size: fontSize,
          font,
          color: rgb(0.1, 0.12, 0.15)
        });
        cursorY -= lineHeight;
      });
    } else {
      const pdfBytes = await fetchPdfBytes(fragment.source);
      const fragmentDoc = await PDFDocument.load(pdfBytes);
      const fragmentPages = await document.copyPages(fragmentDoc, fragmentDoc.getPageIndices());
      fragmentPages.forEach((p) => document.addPage(p));
    }
  }

  return document.save();
};
