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
    // Thin horizontal rule after line 28 at the bottom of writing area
    page.drawLine({
      start: { x: textLeftX, y: PLEADING_BOTTOM_MARGIN },
      end: { x: textRightLimit, y: PLEADING_BOTTOM_MARGIN },
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
  const sigLabelText = 'Signature:';
  const dateY = PLEADING_BOTTOM_MARGIN + PLEADING_BODY_LINE_HEIGHT * 2;
  const sigY = PLEADING_BOTTOM_MARGIN + PLEADING_BODY_LINE_HEIGHT * 1;
  page.drawText(dateLabel, { x: textLeftX, y: dateY, size: 11, font: footerFont });

  // Try to draw image signature next to the label; fallback to underline if unavailable
  const labelWidth = footerFont.widthOfTextAtSize(sigLabelText, 11) + 8;
  let drewImageSignature = false;
  try {
    // Helper: fetch signature bytes, prefer /sig.png then /signature.png
    const fetchSig = async (path) => {
      try {
        const res = await fetch(path);
        if (!res || !res.ok) return null;
        const mime = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
        const buf = await res.arrayBuffer();
        return { bytes: new Uint8Array(buf), mime };
      } catch (_) {
        return null;
      }
    };
    let sig = await fetchSig('/sig.png');
    if (!sig) sig = await fetchSig('/signature.png');
    if (sig && sig.bytes && sig.bytes.length) {
      let img = null;
      const mime = (sig.mime || '').toLowerCase();
      try {
        if (mime.includes('png') || !mime) {
          img = await pdfDoc.embedPng(sig.bytes);
        } else if (mime.includes('jpeg') || mime.includes('jpg')) {
          img = await pdfDoc.embedJpg(sig.bytes);
        } else {
          // Try PNG first then JPG as a fallback
          try { img = await pdfDoc.embedPng(sig.bytes); } catch (_) { img = await pdfDoc.embedJpg(sig.bytes); }
        }
      } catch (_) {
        img = null;
      }
      if (img) {
        // Draw the label, then image scaled to ~2.5in width (180pt) preserving aspect ratio
        page.drawText(sigLabelText, { x: textLeftX, y: sigY, size: 11, font: footerFont });
        const targetW = 180; // 2.5 inches
        const scale = Math.min(1, targetW / img.width);
        const w = img.width * scale;
        const h = img.height * scale;
        const xImg = textLeftX + labelWidth;
        const yImg = sigY - h + 10; // nudge so baseline aligns visually
        page.drawImage(img, { x: xImg, y: yImg, width: w, height: h });
        drewImageSignature = true;
      }
    }
  } catch (_) {
    // ignore and fallback
  }
  if (!drewImageSignature) {
    // Fallback to text line if image isn't available
    const sigFallback = 'Signature: ______________________________';
    page.drawText(sigFallback, { x: textLeftX, y: sigY, size: 11, font: footerFont });
  }
  // Printed name after the signature
  try {
    const printedName = `${(plaintiffName && plaintiffName.trim()) || 'Michael James Romero'}, Plaintiff in Pro Per`;
    const nameY = PLEADING_BOTTOM_MARGIN + PLEADING_BODY_LINE_HEIGHT * 0; // bottom-most reserved line
    page.drawText(printedName, { x: textLeftX, y: nameY, size: 11, font: footerFont });
  } catch (_) {
    // ignore
  }
}

export async function appendPdfFragment(pdfDoc, data) {
  const sourceDoc = await (await import('pdf-lib')).PDFDocument.load(data);
  const copiedPages = await pdfDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
  copiedPages.forEach((page) => pdfDoc.addPage(page));
}

// Draw simple captioned text pages (no pleading header)
export async function appendExhibitIndex(pdfDoc, captions = [], entries = [], title = 'Exhibit Index') {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const textLeftX = PLEADING_LEFT_MARGIN + PLEADING_NUMBER_GUTTER;
  const textRightLimit = LETTER_WIDTH - PLEADING_RIGHT_MARGIN;
  const maxWidth = textRightLimit - textLeftX;
  const lineH = 14;

  let page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  // draw line numbers & borders
  for (let index = 0; index < PLEADING_LINE_COUNT; index += 1) {
    const yLine = LETTER_HEIGHT - PLEADING_TOP_MARGIN - index * PLEADING_BODY_LINE_HEIGHT;
    page.drawText(`${index + 1}`.padStart(2, ' '), { x: PLEADING_LEFT_MARGIN - 26, y: yLine, size: 8, font, color: rgb(0,0,0) });
  }
  page.drawLine({ start: { x: PLEADING_LEFT_MARGIN - 6, y: LETTER_HEIGHT }, end: { x: PLEADING_LEFT_MARGIN - 6, y: 0 }, thickness: 1.2, color: rgb(0,0,0) });
  page.drawLine({ start: { x: textRightLimit, y: LETTER_HEIGHT }, end: { x: textRightLimit, y: 0 }, thickness: 0.8, color: rgb(0,0,0) });
  // Bottom horizontal rule after line 28
  page.drawLine({ start: { x: textLeftX, y: PLEADING_BOTTOM_MARGIN }, end: { x: textRightLimit, y: PLEADING_BOTTOM_MARGIN }, thickness: 0.8, color: rgb(0,0,0) });

  let y = LETTER_HEIGHT - PLEADING_TOP_MARGIN;

  // Captions at top
  const caps = Array.isArray(captions) ? captions.filter(Boolean) : [];
  caps.forEach((c) => {
    page.drawText(String(c), { x: textLeftX, y, size: 12, font: bold, color: rgb(0,0,0) });
    y -= lineH * 1.1;
  });
  if (caps.length) y -= lineH * 0.4;

  // Title (large, centered, all caps)
  if (title) {
    const ttl = String(title).toUpperCase();
    const size = 16;
    const w = bold.widthOfTextAtSize(ttl, size);
    const x = textLeftX + Math.max(0, (maxWidth - w) / 2);
    page.drawText(ttl, { x, y, size, font: bold });
    y -= lineH * 2;
  }

  const wrap = (text, f, size) => {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const attempt = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(attempt, size) > maxWidth) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = attempt;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const ensureSpace = (needed = 1) => {
    if (y <= PLEADING_BOTTOM_MARGIN + needed * lineH) {
      page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
      // draw line numbers on new page
      for (let index = 0; index < PLEADING_LINE_COUNT; index += 1) {
        const yLine = LETTER_HEIGHT - PLEADING_TOP_MARGIN - index * PLEADING_BODY_LINE_HEIGHT;
        page.drawText(`${index + 1}`.padStart(2, ' '), { x: PLEADING_LEFT_MARGIN - 26, y: yLine, size: 8, font, color: rgb(0,0,0) });
      }
      page.drawLine({ start: { x: PLEADING_LEFT_MARGIN - 6, y: LETTER_HEIGHT }, end: { x: PLEADING_LEFT_MARGIN - 6, y: 0 }, thickness: 1.2, color: rgb(0,0,0) });
      page.drawLine({ start: { x: textRightLimit, y: LETTER_HEIGHT }, end: { x: textRightLimit, y: 0 }, thickness: 0.8, color: rgb(0,0,0) });
      page.drawLine({ start: { x: textLeftX, y: PLEADING_BOTTOM_MARGIN }, end: { x: textRightLimit, y: PLEADING_BOTTOM_MARGIN }, thickness: 0.8, color: rgb(0,0,0) });
      y = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
    }
  };

  // Entries: draw bullet with bold label then desc; allow nested children
  const drawEntry = (entry, indentLevel = 0) => {
    const label = String(entry.label || '');
    const desc = String(entry.desc || '');
    const bullet = '• ';
    const bulletW = font.widthOfTextAtSize(bullet, 12);
    const labelW = bold.widthOfTextAtSize(label, 12);
    const sep = desc ? ': ' : '';
    const sepW = desc ? font.widthOfTextAtSize(sep, 12) : 0;
    const baseX = textLeftX + indentLevel * 18; // indent children
    const remainingW = maxWidth - (baseX - textLeftX) - bulletW - labelW - sepW;
    ensureSpace(1);
    page.drawText(bullet, { x: baseX, y, size: 12, font });
    page.drawText(label, { x: baseX + bulletW, y, size: 12, font: bold });
    let x = baseX + bulletW + labelW;
    if (desc) {
      const words = desc.split(/\s+/);
      let cur = sep;
      const indentX = baseX + bulletW + 12; // indent for wrapped lines
      for (const w of words) {
        const attempt = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(attempt, 12) > remainingW) {
          page.drawText(cur, { x, y, size: 12, font });
          y -= lineH;
          ensureSpace(1);
          cur = w;
          x = indentX;
        } else {
          cur = attempt;
        }
      }
      if (cur) page.drawText(cur, { x, y, size: 12, font });
    }
    y -= lineH * 1.1;
    const children = Array.isArray(entry.children) ? entry.children : [];
    children.forEach((child) => drawEntry(child, indentLevel + 1));
  };

  for (const entry of entries) {
    drawEntry(entry, 0);
  }
}

export async function appendExhibitCover(pdfDoc, captions = [], bodyText = '', title = '') {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const textLeftX = PLEADING_LEFT_MARGIN + PLEADING_NUMBER_GUTTER;
  const textRightLimit = LETTER_WIDTH - PLEADING_RIGHT_MARGIN;
  const maxWidth = textRightLimit - textLeftX;
  const lineH = 14;

  let page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  // draw line numbers & borders
  for (let index = 0; index < PLEADING_LINE_COUNT; index += 1) {
    const yLine = LETTER_HEIGHT - PLEADING_TOP_MARGIN - index * PLEADING_BODY_LINE_HEIGHT;
    page.drawText(`${index + 1}`.padStart(2, ' '), { x: PLEADING_LEFT_MARGIN - 26, y: yLine, size: 8, font, color: rgb(0,0,0) });
  }
  page.drawLine({ start: { x: PLEADING_LEFT_MARGIN - 6, y: LETTER_HEIGHT }, end: { x: PLEADING_LEFT_MARGIN - 6, y: 0 }, thickness: 1.2, color: rgb(0,0,0) });
  page.drawLine({ start: { x: textRightLimit, y: LETTER_HEIGHT }, end: { x: textRightLimit, y: 0 }, thickness: 0.8, color: rgb(0,0,0) });
  // Bottom horizontal rule after line 28
  page.drawLine({ start: { x: textLeftX, y: PLEADING_BOTTOM_MARGIN }, end: { x: textRightLimit, y: PLEADING_BOTTOM_MARGIN }, thickness: 0.8, color: rgb(0,0,0) });

  let y = LETTER_HEIGHT - PLEADING_TOP_MARGIN;

  const caps = Array.isArray(captions) ? captions.filter(Boolean) : [];
  caps.forEach((c) => {
    page.drawText(String(c), { x: textLeftX, y, size: 12, font: bold, color: rgb(0,0,0) });
    y -= lineH * 1.1;
  });
  if (caps.length) y -= lineH * 0.4;

  // Precompute wrapped body lines to measure height
  const paraLines = String(bodyText || '').split(/\n+/);
  const wrap = (text) => {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const attempt = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(attempt, 12) > maxWidth) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = attempt;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const wrapped = paraLines.flatMap((p) => wrap(p).concat(['__PARA__']));
  if (wrapped.length && wrapped[wrapped.length - 1] === '__PARA__') wrapped.pop();
  const bodyLineCount = wrapped.reduce((acc, l) => acc + (l === '__PARA__' ? 0.5 : 1), 0);
  const titleBlockH = title ? lineH * 2 : 0; // approximate title block height
  const bodyBlockH = bodyLineCount * lineH;
  const blockH = titleBlockH + (bodyBlockH ? bodyBlockH + lineH * 0.5 : 0);

  // Compute centered start Y within available area below captions
  const availableTopY = y; // current y after captions
  const availableHeight = availableTopY - PLEADING_BOTTOM_MARGIN;
  let startY = PLEADING_BOTTOM_MARGIN + (availableHeight + blockH) / 2;

  // Title (large, centered, all caps) for cover
  if (title) {
    const ttl = String(title).toUpperCase();
    const size = 16;
    const w = bold.widthOfTextAtSize(ttl, size);
    const x = textLeftX + Math.max(0, (maxWidth - w) / 2);
    page.drawText(ttl, { x, y: startY, size, font: bold });
    startY -= lineH * 2;
  }

  // Draw body centered below title
  let cursor = startY;
  for (const l of wrapped) {
    if (l === '__PARA__') {
      cursor -= lineH * 0.5;
      continue;
    }
    if (cursor <= PLEADING_BOTTOM_MARGIN + lineH) {
      page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
      // draw line numbers on new page
      for (let index = 0; index < PLEADING_LINE_COUNT; index += 1) {
        const yLine = LETTER_HEIGHT - PLEADING_TOP_MARGIN - index * PLEADING_BODY_LINE_HEIGHT;
        page.drawText(`${index + 1}`.padStart(2, ' '), { x: PLEADING_LEFT_MARGIN - 26, y: yLine, size: 8, font, color: rgb(0,0,0) });
      }
      page.drawLine({ start: { x: PLEADING_LEFT_MARGIN - 6, y: LETTER_HEIGHT }, end: { x: PLEADING_LEFT_MARGIN - 6, y: 0 }, thickness: 1.2, color: rgb(0,0,0) });
      page.drawLine({ start: { x: textRightLimit, y: LETTER_HEIGHT }, end: { x: textRightLimit, y: 0 }, thickness: 0.8, color: rgb(0,0,0) });
        page.drawLine({ start: { x: textLeftX, y: PLEADING_BOTTOM_MARGIN }, end: { x: textRightLimit, y: PLEADING_BOTTOM_MARGIN }, thickness: 0.8, color: rgb(0,0,0) });
      cursor = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
    }
    page.drawText(l, { x: textLeftX, y: cursor, size: 12, font });
    cursor -= lineH;
  }
}
