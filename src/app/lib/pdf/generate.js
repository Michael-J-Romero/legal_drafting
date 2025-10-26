'use client';

import { StandardFonts, rgb } from 'pdf-lib';
import removeMarkdown from 'remove-markdown';

export const LETTER_WIDTH = 612; // 8.5in * 72
export const LETTER_HEIGHT = 792; // 11in * 72
export const PLEADING_LEFT_MARGIN = 72;
export const PLEADING_RIGHT_MARGIN = 36;
export const PLEADING_TOP_MARGIN = 72;
export const PLEADING_BOTTOM_MARGIN = 72;
export const PLEADING_NUMBER_GUTTER = 28;
export const PLEADING_LINE_COUNT = 28;
export const PLEADING_BODY_LINE_HEIGHT =
  (LETTER_HEIGHT - PLEADING_TOP_MARGIN - PLEADING_BOTTOM_MARGIN) / PLEADING_LINE_COUNT;

export async function appendMarkdownFragment(pdfDoc, content, heading, fragmentTitle, docDate, formatDisplayDate) {
  const clean = removeMarkdown(content || '').trim();
  const {
    leftFields = [],
    rightFields = [],
    plaintiffName = '',
    defendantName = '',
  } = heading || {};

  const trimmedLeft = leftFields.filter((value) => value.trim());
  const trimmedRight = rightFields.filter((value) => value.trim());
  const hasHeadingContent =
    trimmedLeft.length ||
    trimmedRight.length ||
    (plaintiffName && plaintiffName.trim()) ||
    (defendantName && defendantName.trim());

  if (!clean && !hasHeadingContent) {
    return;
  }

  const headerFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const headerBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const bodyBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const textLeftX = PLEADING_LEFT_MARGIN + PLEADING_NUMBER_GUTTER;
  const textRightLimit = LETTER_WIDTH - PLEADING_RIGHT_MARGIN;
  const maxWidth = textRightLimit - textLeftX;
  const headerLineHeight = 14;
  const uppercaseTitle = (fragmentTitle || '').trim().toUpperCase();

  const drawLineNumbers = (page) => {
    const top = LETTER_HEIGHT - PLEADING_TOP_MARGIN; // content top
    for (let index = 0; index < PLEADING_LINE_COUNT; index += 1) {
      const y = top - index * PLEADING_BODY_LINE_HEIGHT;
      page.drawText(`${index + 1}`.padStart(2, ' '), {
        x: PLEADING_LEFT_MARGIN - 26,
        y,
        size: 8,
        font: bodyFont,
        color: rgb(0, 0, 0),
      });
    }
    page.drawLine({
      start: { x: PLEADING_LEFT_MARGIN - 6, y: LETTER_HEIGHT },
      end: { x: PLEADING_LEFT_MARGIN - 6, y: 0 },
      thickness: 1.2,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: textRightLimit, y: LETTER_HEIGHT },
      end: { x: textRightLimit, y: 0 },
      thickness: 0.8,
      color: rgb(0, 0, 0),
    });
  };

  const preparePage = () => {
    const page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
    drawLineNumbers(page);
    return page;
  };

  const drawHeading = (page) => {
    let cursorY = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
    const headerLines = Math.max(trimmedLeft.length, 7);

    trimmedLeft.forEach((value, index) => {
      const y = cursorY - index * headerLineHeight;
      page.drawText(value, {
        x: textLeftX,
        y,
        size: 10,
        font: headerFont,
        color: rgb(0, 0, 0),
      });
    });

    cursorY -= headerLines * headerLineHeight + headerLineHeight;

    const captionHeight = headerLineHeight * 4;
    const captionTop = cursorY;
    const captionBottom = captionTop - captionHeight;
    const captionWidth = Math.min(240, maxWidth * 0.45);
    const captionX = textLeftX;

    page.drawRectangle({
      x: captionX,
      y: captionBottom,
      width: captionWidth,
      height: captionHeight,
      borderWidth: 1,
      borderColor: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: captionX + captionWidth, y: captionBottom },
      end: { x: captionX + captionWidth, y: captionTop },
      thickness: 2,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: captionX, y: captionBottom },
      end: { x: captionX + captionWidth, y: captionBottom },
      thickness: 2,
      color: rgb(0, 0, 0),
    });

    let partyY = captionTop - headerLineHeight * 1.2;
    const partyLabelSize = 10;
    const partyValueSize = 12;

    page.drawText('Plaintiff:', {
      x: captionX + 8,
      y: partyY,
      size: partyLabelSize,
      font: headerFont,
    });
    const plaintiffValue = (plaintiffName && plaintiffName.trim()) || '____________________________';
    page.drawText(plaintiffValue, {
      x: captionX + 80,
      y: partyY,
      size: partyValueSize,
      font: headerBold,
    });

    partyY -= headerLineHeight * 1.1;

    page.drawText('v.', {
      x: captionX + captionWidth / 2 - 6,
      y: partyY,
      size: partyValueSize,
      font: headerBold,
    });

    partyY -= headerLineHeight * 1.1;

    page.drawText('Defendant:', {
      x: captionX + 8,
      y: partyY,
      size: partyLabelSize,
      font: headerFont,
    });
    const defendantValue = (defendantName && defendantName.trim()) || '____________________________';
    page.drawText(defendantValue, {
      x: captionX + 80,
      y: partyY,
      size: partyValueSize,
      font: headerBold,
    });

    const rightColumnX = captionX + captionWidth + 24;
    let rightCursor = captionTop - headerLineHeight;
    trimmedRight.forEach((value) => {
      page.drawText(value, {
        x: rightColumnX,
        y: rightCursor,
        size: 11,
        font: headerFont,
      });
      rightCursor -= headerLineHeight;
    });

    if (!trimmedRight.length) {
      page.drawText('Court, judge, department details', {
        x: rightColumnX,
        y: rightCursor,
        size: 11,
        font: headerFont,
        color: rgb(0.45, 0.45, 0.45),
      });
      rightCursor -= headerLineHeight;
    }

    cursorY = captionBottom - headerLineHeight * 1.5;

    if (uppercaseTitle) {
      page.drawText(uppercaseTitle, {
        x: captionX,
        y: cursorY,
        size: 14,
        font: headerBold,
      });
      cursorY -= headerLineHeight * 2;
    } else {
      page.drawText('DOCUMENT TITLE', {
        x: captionX,
        y: cursorY,
        size: 14,
        font: headerBold,
        color: rgb(0.45, 0.45, 0.45),
      });
      cursorY -= headerLineHeight * 2;
    }

    return cursorY;
  };

  let page = preparePage();
  let cursorY = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
  let headingDrawn = false;

  if (hasHeadingContent) {
    cursorY = drawHeading(page);
    headingDrawn = true;
  }

  const lines = clean ? clean.split(/\n+/) : [];

  const commitLine = (line) => {
    if (!line.trim()) {
      cursorY -= PLEADING_BODY_LINE_HEIGHT;
      return;
    }

    const words = line.split(/\s+/);
    let current = '';

    const flush = () => {
      if (!current.trim()) return;
      if (cursorY <= PLEADING_BOTTOM_MARGIN) {
        page = preparePage();
        cursorY = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
        if (hasHeadingContent && !headingDrawn) {
          cursorY = drawHeading(page);
          headingDrawn = true;
        }
      }
      page.drawText(current.trim(), {
        x: textLeftX,
        y: cursorY,
        size: 12,
        font: bodyFont,
      });
      cursorY -= PLEADING_BODY_LINE_HEIGHT;
      current = '';
    };

    words.forEach((word) => {
      const attempt = current ? `${current} ${word}` : word;
      const width = bodyFont.widthOfTextAtSize(attempt, 12);
      if (width > maxWidth) {
        flush();
        current = word;
      } else {
        current = attempt;
      }
    });

    flush();
  };

  lines.forEach((line, index) => {
    commitLine(line);
    if (index < lines.length - 1) {
      cursorY -= PLEADING_BODY_LINE_HEIGHT * 0.5;
    }
  });

  const footerFont = bodyFont;
  const neededLines = 3;
  if (cursorY <= PLEADING_BOTTOM_MARGIN + neededLines * PLEADING_BODY_LINE_HEIGHT) {
    page = preparePage();
    cursorY = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
  }
  const sigDate = typeof formatDisplayDate === 'function' ? formatDisplayDate(docDate) : (docDate || '__________');
  const dateLabel = `Date: ${sigDate}`;
  const sigLabel = 'Signature: ______________________________';
  const dateY = PLEADING_BOTTOM_MARGIN + PLEADING_BODY_LINE_HEIGHT * 2;
  const sigY = PLEADING_BOTTOM_MARGIN + PLEADING_BODY_LINE_HEIGHT * 1;
  page.drawText(dateLabel, { x: textLeftX, y: dateY, size: 11, font: footerFont });
  page.drawText(sigLabel, { x: textLeftX, y: sigY, size: 11, font: footerFont });
}

export async function appendPdfFragment(pdfDoc, data) {
  const sourceDoc = await (await import('pdf-lib')).PDFDocument.load(data);
  const copiedPages = await pdfDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
  copiedPages.forEach((page) => pdfDoc.addPage(page));
}
