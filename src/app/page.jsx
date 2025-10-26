'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// ...existing code...
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useReactToPrint } from 'react-to-print';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import removeMarkdown from 'remove-markdown';
import '/src/App.css';
// Avoid static import of pdfjs to prevent SSR/bundler issues; we'll lazy-load the legacy build in effect
// import { getDocument } from 'pdfjs-dist';
// Removed @react-pdf-viewer styles to avoid pdfjs issues in SSR/client hydration

// Remove react-pdf dynamic imports
  
let fragmentCounter = 0;

// Debug helper: keep a rolling log in the window for easy inspection
function pushPdfjsLog(event, details) {
  try {
    // eslint-disable-next-line no-console
    console.log(`[pdfjs-debug] ${event}`, details || '');
  } catch (_) {}
  try {
    if (typeof window !== 'undefined') {
      window.__pdfjsLoadLog = window.__pdfjsLoadLog || [];
      window.__pdfjsLoadLog.push({
        ts: Date.now(),
        event,
        details: (() => {
          // Make details JSON-safe and small
          if (!details || typeof details !== 'object') return details;
          const out = {};
          for (const k of Object.keys(details)) {
            const v = details[k];
            if (v == null) out[k] = v;
            else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
            else if (k === 'error' && v) out[k] = { message: String(v.message), stack: String(v.stack || '') };
            else if (Array.isArray(v)) out[k] = v.slice(0, 10);
            else out[k] = typeof v;
          }
          return out;
        })(),
      });
      // cap size
      if (window.__pdfjsLoadLog.length > 200) window.__pdfjsLoadLog.shift();
    }
  } catch (_) {}
}

pushPdfjsLog('env.init', {
  hasWindow: typeof window !== 'undefined',
  hasDocument: typeof document !== 'undefined',
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
});

// Load pdfjs from the legacy CJS/UMD build to avoid ESM interop issues in Webpack/Next 13
async function loadPdfjs() {
  const attempts = [
    { label: 'legacy/cjs', loader: async () => import('pdfjs-dist/legacy/build/pdf') },
    { label: 'build/cjs', loader: async () => import('pdfjs-dist/build/pdf') },
  ];
  const errors = [];
  pushPdfjsLog('loadPdfjs.start', { attempts: attempts.map((a) => a.label) });
  for (const attempt of attempts) {
    try {
      pushPdfjsLog('loadPdfjs.try', { attempt: attempt.label });
      const mod = await attempt.loader();
      const isEsModule = !!(mod && mod.__esModule);
      const modKeys = mod ? Object.keys(mod).slice(0, 20) : [];
      const hasDefault = !!(mod && mod.default);
      const defaultKeys = mod && mod.default ? Object.keys(mod.default).slice(0, 20) : [];
      const candidate = mod && (mod.getDocument ? mod : mod.default);
      pushPdfjsLog('loadPdfjs.loaded', { attempt: attempt.label, isEsModule, modKeys, hasDefault, defaultKeys, hasGetDoc: !!(candidate && candidate.getDocument) });
      if (candidate && typeof candidate.getDocument === 'function') {
        pushPdfjsLog('loadPdfjs.success', { attempt: attempt.label });
        return candidate;
      }
      const e = new Error('Loaded pdfjs module does not expose getDocument');
      errors.push(e);
      pushPdfjsLog('loadPdfjs.missingGetDocument', { attempt: attempt.label });
    } catch (err) {
      errors.push(err);
      pushPdfjsLog('loadPdfjs.error', { attempt: attempt.label, error: { message: String(err?.message || err), stack: String(err?.stack || '') } });
    }
  }
  if (errors.length) {
    console.error('Failed to load pdfjs-dist. Falling back to iframe preview.', errors);
    pushPdfjsLog('loadPdfjs.failAll', { errors: errors.map((e) => String(e && e.message ? e.message : e)) });
  }
  // Final fallback: load a UMD build from a CDN (v3.x known-good in many Next.js setups)
  try {
    pushPdfjsLog('loadPdfjs.cdnTry', { version: '3.10.111' });
    const pdfjs = await loadPdfjsFromCdn('3.10.111');
    if (pdfjs && typeof pdfjs.getDocument === 'function') {
      pushPdfjsLog('loadPdfjs.cdnSuccess', { version: '3.10.111' });
      return pdfjs;
    }
    pushPdfjsLog('loadPdfjs.cdnMissingGetDocument', { version: '3.10.111' });
  } catch (cdnErr) {
    pushPdfjsLog('loadPdfjs.cdnError', { message: String(cdnErr?.message || cdnErr) });
  }
  return null;
}

// Load PDF.js UMD from CDN and return window.pdfjsLib
function loadScriptOnce(src, id) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined') return reject(new Error('no window'));
      const existing = id ? document.getElementById(id) : null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e?.error || new Error('script error')));
        return;
      }
      const s = document.createElement('script');
      if (id) s.id = id;
      s.async = true;
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = (e) => reject(e?.error || new Error('script error'));
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
}

async function loadPdfjsFromCdn(version = '3.10.111') {
  if (typeof window === 'undefined') throw new Error('no window');
  if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') {
    return window.pdfjsLib;
  }
  const base = `https://unpkg.com/pdfjs-dist@${version}/build`;
  const url = `${base}/pdf.min.js`;
  pushPdfjsLog('cdn.loadScript', { url });
  await loadScriptOnce(url, '__pdfjs_cdn_script');
  const pdfjs = window.pdfjsLib;
  if (pdfjs && pdfjs.GlobalWorkerOptions) {
    // We still disable the worker, but set workerSrc defensively
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.js`;
    } catch (_) {}
  }
  return pdfjs;
}

const LETTER_WIDTH = 612; // 8.5in * 72
const LETTER_HEIGHT = 792; // 11in * 72
const MARKDOWN_MARGIN = 56;
const PAGE_PREVIEW_WIDTH = Math.round(8.5 * 96);
const PLEADING_LEFT_MARGIN = 72;
const PLEADING_RIGHT_MARGIN = 36;
const PLEADING_TOP_MARGIN = 72;
const PLEADING_BOTTOM_MARGIN = 72;
const PLEADING_NUMBER_GUTTER = 28;
const PLEADING_LINE_COUNT = 28;
const PLEADING_BODY_LINE_HEIGHT =
  (LETTER_HEIGHT - PLEADING_TOP_MARGIN - PLEADING_BOTTOM_MARGIN) / PLEADING_LINE_COUNT;

function createFragmentId() {
  fragmentCounter += 1;
  return `fragment-${fragmentCounter}`;
}

function PleadingPage({ heading, title, children, pageNumber, totalPages, firstPage = false, docDate }) {
  const {
    leftFields = [],
    rightFields = [],
    plaintiffName = '',
    defendantName = '',
    courtTitle = '',
  } = heading || {};

  const normalizedLeft = leftFields.filter((value) => value.trim());
  const normalizedRight = rightFields.filter((value) => value.trim());
  const upperTitle = (title || '').trim().toUpperCase();
  return (
    <div className="page-surface markdown-fragment">
      <div className="pleading-paper">
        <div className="pleading-line-column" aria-hidden>
          {Array.from({ length: PLEADING_LINE_COUNT }, (_, index) => (
            <span key={`line-${index}`}>{index + 1}</span>
          ))}
        </div>
        <div className="pleading-main">
          {firstPage && (
            <>
              <header className="pleading-header">
                <div className="pleading-contact">
                  {normalizedLeft.length ? (
                    normalizedLeft.map((value, index) => (
                      <div key={`left-field-${index}`} className="pleading-contact-line">
                        {value}
                      </div>
                    ))
                  ) : (
                    <div className="pleading-contact-line pleading-placeholder">Attorney or party information</div>
                  )}
                </div>
                <div className="pleading-clerk-space" aria-hidden />
              </header>

              {courtTitle?.trim() ? (
                <div className="pleading-court-title">{courtTitle.trim().toUpperCase()}</div>
              ) : null}

              <div className="pleading-caption">
                <div className="pleading-caption-left">
                  <div className="pleading-caption-box">
                    <div className="pleading-party-block">
                      <span className="pleading-party-value">{plaintiffName || 'Plaintiff Name'},</span>
                      <span className="pleading-party-label">Plaintiff,</span>
                    </div>
                    <div className="pleading-versus">v.</div>
                    <div className="pleading-party-block">
                      <span className="pleading-party-value">{defendantName || 'Defendant Name'},</span>
                      <span className="pleading-party-label">Defendant,</span>
                    </div>
                  </div>
                </div>
                <div className="pleading-caption-right">
                  {normalizedRight.length ? (
                    normalizedRight.map((value, index) => (
                      <div key={`right-field-${index}`} className="pleading-right-line">
                        {value}
                      </div>
                    ))
                  ) : (
                    <div className="pleading-right-line pleading-placeholder">
                      Court, judge, department details
                    </div>
                  )}
                </div>
              </div>

              <div className="pleading-document-title">
                {upperTitle || 'DOCUMENT TITLE'}
              </div>
            </>
          )}

          <div className="pleading-body">{children}</div>
          {pageNumber === totalPages && (
            <div className="signature-row">
              <div className="signature-date">Date: {formatDisplayDate(docDate)}</div>
              <div className="signature-line">Signature: ______________________________</div>
            </div>
          )}
          <div className="page-footer" aria-hidden>
            <span>
              Page {pageNumber} of {totalPages}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Paginate Markdown across multiple pleading pages for on-screen preview
function PaginatedMarkdown({ content, heading, title, docDate }) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState([]);

  // Basic helpers to classify blocks
  const isParagraphBlock = (block) => {
    const trimmed = block.trim();
    if (!trimmed) return true;
    // Non-paragraph starts: headings, lists, blockquotes, tables, code fences
    if (/^(#{1,6})\s/.test(trimmed)) return false;
    if (/^\s*([-*+]\s)/.test(trimmed)) return false;
    if (/^\s*\d+\.\s/.test(trimmed)) return false;
    if (/^\s*>\s?/.test(trimmed)) return false;
    if (/^\s*\|.*\|\s*$/.test(trimmed)) return false;
    if (/^\s*```/.test(trimmed)) return false;
    return true;
  };

  useEffect(() => {
    if (!measurerRef.current) return;

    const root = measurerRef.current;
    const main = root.querySelector('.pleading-main');
    const body = root.querySelector('.pleading-body');
    if (!main || !body) return;

    const cs = window.getComputedStyle(body);
    const lineHeightPx = parseFloat(cs.lineHeight);
    const bodyWidth = body.getBoundingClientRect().width;
    const mainHeight = main.getBoundingClientRect().height;
    const bodyTop = body.getBoundingClientRect().top - main.getBoundingClientRect().top;
    const firstPageAvail = Math.floor((mainHeight - bodyTop) / lineHeightPx);
    const fullPageAvail = Math.floor(mainHeight / lineHeightPx);

    // Prepare canvas for text measurement
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // Match body text font
    ctx.font = `${cs.fontSize || '12pt'} ${cs.fontFamily || 'Times New Roman, Times, serif'}`;

    const wrapParagraphToLines = (text) => {
      const words = text.split(/\s+/);
      const lines = [];
      let current = '';
      words.forEach((w) => {
        const attempt = current ? `${current} ${w}` : w;
        const width = ctx.measureText(attempt).width;
        if (width > bodyWidth && current) {
          lines.push(current);
          current = w;
        } else {
          current = attempt;
        }
      });
      if (current) lines.push(current);
      return lines;
    };

    const blocks = content.split(/\n\n+/); // crude block split
    const outputPages = [];
    let currentPage = [];
    let remainingLines = firstPageAvail;

    const pushPage = () => {
      outputPages.push(currentPage);
      currentPage = [];
      remainingLines = fullPageAvail;
    };

    for (let i = 0; i < blocks.length; i += 1) {
      let block = blocks[i];
      if (!block.trim()) {
        // blank paragraph spacing ~ half line; approximate as 1 line occasionally
        if (remainingLines <= 1) {
          pushPage();
        } else {
          currentPage.push('');
          remainingLines -= 1;
        }
        continue;
      }

      if (!isParagraphBlock(block)) {
        // Measure this block by temporarily rendering it in the measurer body
        const temp = document.createElement('div');
        temp.style.visibility = 'hidden';
        body.appendChild(temp);
        // Render with React into temp is heavy; approximate as 6 lines for small blocks if cannot measure
        temp.textContent = block.replace(/[#*>`_\-\d\.]/g, '');
        const approxLines = Math.max(1, Math.ceil(temp.getBoundingClientRect().height / lineHeightPx) || 4);
        body.removeChild(temp);
        if (approxLines > remainingLines) {
          pushPage();
        }
        currentPage.push(block);
        remainingLines -= Math.min(remainingLines, approxLines);
      } else {
        // Paragraph: split by lines based on width
        let para = block.replace(/\s+/g, ' ').trim();
        const lines = wrapParagraphToLines(para);
        let start = 0;
        while (start < lines.length) {
          if (remainingLines === 0) pushPage();
          const canTake = Math.min(remainingLines, lines.length - start);
          const slice = lines.slice(start, start + canTake).join(' ');
          currentPage.push(slice);
          start += canTake;
          remainingLines -= canTake;
          if (start < lines.length) pushPage();
        }
        // Add paragraph margin as a spacer line if room
        if (remainingLines === 0) pushPage();
        if (remainingLines > 0) {
          currentPage.push('');
          remainingLines -= 1;
        }
      }
    }

    if (currentPage.length || !outputPages.length) outputPages.push(currentPage);
    setPages(outputPages);
  }, [content, heading, title]);

  // Render hidden measurer and visible pages
  return (
    <>
      <div ref={measurerRef} className="page-measurer" aria-hidden style={{ position: 'absolute', inset: '-10000px auto auto -10000px' }}>
        <PleadingPage heading={heading} title={title} firstPage pageNumber={1} totalPages={1} docDate={docDate}>
          {/* Empty body for measuring sizes */}
        </PleadingPage>
      </div>
      {pages.map((blocks, pageIndex) => (
        <div className="page-wrapper" key={`md-page-${pageIndex}`}> 
          <button
            type="button"
            className="fullscreen-toggle"
            title="Fullscreen"
            onClick={() => { /* fullscreen handled by outer preview using fragment id */ }}
          >
            ⤢
          </button>
          <PleadingPage
            heading={heading}
            title={title}
            firstPage={pageIndex === 0}
            pageNumber={pageIndex + 1}
            totalPages={pages.length}
            docDate={docDate}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: (props) => <table className="md-table" {...props} />,
                th: (props) => <th className="md-table-cell" {...props} />,
                td: (props) => <td className="md-table-cell" {...props} />,
              }}
            >
              {blocks.join('\n\n')}
            </ReactMarkdown>
          </PleadingPage>
        </div>
      ))}
    </>
  );
}

function formatDisplayDate(dateStr) {
  try {
    if (!dateStr) return '__________';
    // Expecting YYYY-MM-DD from input[type="date"]
    const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    const fmt = date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'UTC',
    });
    return fmt;
  } catch (_) {
    return dateStr;
  }
}
// Lightweight PDF preview using an iframe
function PdfPreview({ data }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    async function renderPdf() {
      if (!data || !containerRef.current) return;
      const container = containerRef.current;
      container.innerHTML = '';
      try {
        // Dynamically import pdfjs in a robust way to avoid SSR/bundler pitfalls
        pushPdfjsLog('renderPdf.start', { size: data?.byteLength, disableWorker: true });
        const pdfjs = await loadPdfjs();
        pushPdfjsLog('renderPdf.loaded', { hasPdfjs: !!pdfjs, hasGetDocument: !!pdfjs?.getDocument });
        if (!pdfjs || !pdfjs.getDocument) {
          throw new Error('pdfjs failed to load getDocument');
        }
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), disableWorker: true });
        pushPdfjsLog('renderPdf.getDocument', { hasPromise: !!loadingTask?.promise });
        const pdf = await loadingTask.promise;
        pushPdfjsLog('renderPdf.docReady', { numPages: pdf?.numPages });
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          if (cancelled) break;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '8.5in';
          canvas.style.height = 'auto';
          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'pdf-page';
          pageWrapper.appendChild(canvas);
          container.appendChild(pageWrapper);
          pushPdfjsLog('renderPdf.pageStart', { pageNum, w: canvas.width, h: canvas.height });
          await page.render({ canvasContext: context, viewport }).promise;
          pushPdfjsLog('renderPdf.pageDone', { pageNum });
        }
        pushPdfjsLog('renderPdf.done');
      } catch (err) {
        console.error('PDF preview error:', err);
        pushPdfjsLog('renderPdf.error', { message: String(err?.message || err), stack: String(err?.stack || '') });
        // Fallback: embed browser PDF viewer via object URL
        try {
          try { console.warn('PDF.js preview failed, falling back to iframe method.'); } catch (_) {}
          objectUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
          const iframe = document.createElement('iframe');
          iframe.src = objectUrl;
          iframe.title = 'PDF preview';
          iframe.style.width = '8.5in';
          iframe.style.height = '11in';
          iframe.style.border = 'none';
          const wrapper = document.createElement('div');
          wrapper.className = 'pdf-page';
          wrapper.appendChild(iframe);
          container.appendChild(wrapper);
          pushPdfjsLog('renderPdf.fallbackIframe', { urlCreated: !!objectUrl });
        } catch (fallbackErr) {
          const fallback = document.createElement('div');
          fallback.className = 'page-surface pdf-placeholder';
          const msg = err && (err.message || String(err));
          fallback.textContent = `Failed to render PDF${msg ? `: ${msg}` : ''}`;
          container.appendChild(fallback);
          pushPdfjsLog('renderPdf.fallbackError', { message: String(fallbackErr?.message || fallbackErr) });
        }
      }
    }
    renderPdf();
    return () => {
      cancelled = true;
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      }
    };
  }, [data]);

  return <div ref={containerRef} className="pdf-document" />;
}

async function appendMarkdownFragment(pdfDoc, content, heading, fragmentTitle, docDate) {
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
    plaintiffName.trim() ||
    defendantName.trim();

  if (!clean && !hasHeadingContent) {
    return;
  }

  // Use Helvetica (Arial-like) for headings, Times New Roman for body
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
    // Full-height vertical rules (span entire page height)
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
    const plaintiffValue = plaintiffName.trim() || '____________________________';
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
    const defendantValue = defendantName.trim() || '____________________________';
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

  // Draw signature block at bottom of the last page for this fragment
  const footerFont = bodyFont;
  const neededLines = 3;
  if (cursorY <= PLEADING_BOTTOM_MARGIN + neededLines * PLEADING_BODY_LINE_HEIGHT) {
    page = preparePage();
    cursorY = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
    // Only draw heading on first page; keep headingDrawn true
  }
  const sigDate = formatDisplayDate(docDate);
  const dateLabel = `Date: ${sigDate}`;
  const sigLabel = 'Signature: ______________________________';
  const dateY = PLEADING_BOTTOM_MARGIN + PLEADING_BODY_LINE_HEIGHT * 2;
  const sigY = PLEADING_BOTTOM_MARGIN + PLEADING_BODY_LINE_HEIGHT * 1;
  page.drawText(dateLabel, { x: textLeftX, y: dateY, size: 11, font: footerFont });
  page.drawText(sigLabel, { x: textLeftX, y: sigY, size: 11, font: footerFont });
}

async function appendPdfFragment(pdfDoc, data) {
  const sourceDoc = await PDFDocument.load(data);
  const copiedPages = await pdfDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
  copiedPages.forEach((page) => pdfDoc.addPage(page));
}

function FragmentList({ fragments, onChangeContent, onChangeTitle, onMove, onRemove, onOpenEditor }) {
  return (
    <div className="fragment-list">
      {fragments.map((fragment, index) => (
        <div key={fragment.id} className="fragment-item">
          <div className="fragment-header">
            <span className="fragment-index">{index + 1}.</span>
            <span className="fragment-label">
              {fragment.type === 'markdown' ? (fragment.title?.trim() || 'Untitled Markdown') : fragment.name || 'PDF'}
            </span>
            <div className="fragment-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => onMove(index, -1)}
                disabled={index === 0}
              >
                ↑
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => onMove(index, 1)}
                disabled={index === fragments.length - 1}
              >
                ↓
              </button>
              {fragment.type === 'markdown' && (
                <button
                  type="button"
                  className="ghost"
                  title="Edit fullscreen"
                  onClick={() => onOpenEditor && onOpenEditor(fragment.id)}
                >
                  ⤢
                </button>
              )}
              <button type="button" className="ghost" onClick={() => onRemove(fragment.id)}>
                ✕
              </button>
            </div>
          </div>
          {fragment.type === 'markdown' ? (
            <>
              <input
                type="text"
                className="heading-input"
                placeholder="Entry title"
                value={fragment.title || ''}
                onChange={(e) => onChangeTitle && onChangeTitle(fragment.id, e.target.value)}
              />
              <textarea
                value={fragment.content}
                onChange={(event) => onChangeContent(fragment.id, event.target.value)}
                className="markdown-editor"
                rows={6}
              />
            </>
          ) : (
            <p className="pdf-summary">{fragment.name}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function HeadingFieldList({
  label,
  fields,
  onAdd,
  onRemove,
  onChange,
  addLabel = 'Add line',
}) {
  return (
    <div className="heading-field-section">
      <div className="heading-section-header">
        <span>{label}</span>
        <button type="button" className="ghost small" onClick={onAdd}>
          {addLabel}
        </button>
      </div>
      {fields.length ? (
        fields.map((value, index) => (
          <div className="heading-field-row" key={`${label}-${index}`}>
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(index, event.target.value)}
              className="heading-input"
            />
            <button
              type="button"
              className="ghost small danger"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${label} line ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))
      ) : (
        <p className="help-text">No lines yet.</p>
      )}
    </div>
  );
}

export default function App() {
  const [docDate, setDocDate] = useState(() => {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch (_) {
      return '';
    }
  });
  const [leftHeadingFields, setLeftHeadingFields] = useState([
    'Michael Romero',
    '304 W Avenue 43,',
    'Los Angeles, CA 90065',
    '(909) 201-1181',
    'mikeromero4@Yahoo.com',
    'Plaintiff in Pro Per',
  ]);
  const [rightHeadingFields, setRightHeadingFields] = useState([
    // 'SUPERIOR COURT OF THE STATE OF CALIFORNIA,',
    'Case No. CIVRS2501874',
    'Assigned Judge: Hon. Kory Mathewson',
    '8303 Haven Avenue',
    'Rancho Cucamonga, CA 91730',
    'Dept R12',
  ]);
  // return 8
  const [plaintiffName, setPlaintiffName] = useState('Michael James Romero');
  const [defendantName, setDefendantName] = useState('Megan Nicole Bentley');
  const [courtTitle, setCourtTitle] = useState('SUPERIOR COURT OF THE STATE OF CALIFORNIA, COUNTY OF SAN BERNARDINO');
  const [headingExpanded, setHeadingExpanded] = useState(true);
  const [markdownDraft, setMarkdownDraft] = useState('');
  const [markdownTitleDraft, setMarkdownTitleDraft] = useState('');
  const [fragments, setFragments] = useState(() => [
    {
      id: createFragmentId(),
      type: 'markdown',
      content:
        '# Welcome to the legal drafting preview\n\nUse the panel on the left to add Markdown notes or attach PDFs. Drag the order using the arrows to see how the combined packet will render when printed.',
      title: 'Welcome',
    },
  ]);
  const [fullscreenFragmentId, setFullscreenFragmentId] = useState(null);
  const [editingFragmentId, setEditingFragmentId] = useState(null);
  const [isDraftEditorOpen, setIsDraftEditorOpen] = useState(false);

  // Load a default PDF from the public folder on first load
  const defaultPdfLoadedRef = useRef(false);
  useEffect(() => {
    if (defaultPdfLoadedRef.current) return;
    defaultPdfLoadedRef.current = true;

    const defaultPdfName = 'ammended notice2.pdf';
    const defaultPdfPath = '/pdfs/ammended%20notice2.pdf';

    // If a fragment with this name already exists (e.g., after HMR), skip
    const hasDefault = fragments.some(
      (f) => f.type === 'pdf' && (f.name === defaultPdfName)
    );
    if (hasDefault) return;

    fetch(defaultPdfPath)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch default PDF: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        setFragments((current) => [
          { id: createFragmentId(), type: 'pdf', data: buffer, name: defaultPdfName },
          ...current,
        ]);
      })
      .catch(() => {
        // Silently ignore if the file isn't present; UI will still work
      });
  }, []);

  const previewRef = useRef(null);
  const inputRef = useRef(null);

  const headingSettings = useMemo(
    () => ({
      leftFields: leftHeadingFields,
      rightFields: rightHeadingFields,
      plaintiffName,
      defendantName,
      courtTitle,
    }),
    [leftHeadingFields, rightHeadingFields, plaintiffName, defendantName, courtTitle],
  );

  const handleAddLeftField = useCallback(() => {
    setLeftHeadingFields((current) => [...current, '']);
  }, []);

  const handleLeftFieldChange = useCallback((index, value) => {
    setLeftHeadingFields((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }, []);

  const handleRemoveLeftField = useCallback((index) => {
    setLeftHeadingFields((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const handleAddRightField = useCallback(() => {
    setRightHeadingFields((current) => [...current, '']);
  }, []);

  const handleRightFieldChange = useCallback((index, value) => {
    setRightHeadingFields((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }, []);

  const handleRemoveRightField = useCallback((index) => {
    setRightHeadingFields((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  // react-to-print v3: use `contentRef` instead of the deprecated `content` callback
  const handlePrint = useReactToPrint({
    contentRef: previewRef,
    documentTitle: 'legal-drafting-preview',
  });

  const handleMarkdownSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (!markdownDraft.trim()) return;
      setFragments((current) => [
        ...current,
        {
          id: createFragmentId(),
          type: 'markdown',
          content: markdownDraft.trim(),
          title: markdownTitleDraft.trim() || 'Untitled',
        },
      ]);
      setMarkdownDraft('');
      setMarkdownTitleDraft('');
    },
    [markdownDraft, markdownTitleDraft],
  );

  const handlePdfUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setFragments((current) => [
      ...current,
      { id: createFragmentId(), type: 'pdf', data: buffer, name: file.name },
    ]);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const handleFragmentContentChange = useCallback((id, content) => {
    setFragments((current) =>
      current.map((fragment) => (fragment.id === id ? { ...fragment, content } : fragment)),
    );
  }, []);

  const handleFragmentTitleChange = useCallback((id, title) => {
    setFragments((current) =>
      current.map((fragment) => (fragment.id === id ? { ...fragment, title } : fragment)),
    );
  }, []);

  const handleMoveFragment = useCallback((index, delta) => {
    setFragments((current) => {
      const next = [...current];
      const targetIndex = index + delta;
      if (targetIndex < 0 || targetIndex >= next.length) return current;
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const handleRemoveFragment = useCallback((id) => {
    setFragments((current) => current.filter((fragment) => fragment.id !== id));
  }, []);

  const handleCompilePdf = useCallback(async () => {
    if (!fragments.length) return;
    const pdfDoc = await PDFDocument.create();

    for (const fragment of fragments) {
      if (fragment.type === 'markdown') {
        await appendMarkdownFragment(pdfDoc, fragment.content, headingSettings, fragment.title, docDate);
      } else if (fragment.type === 'pdf') {
        await appendPdfFragment(pdfDoc, fragment.data);
      }
    }

    // Add page numbers at bottom center: "Page X of Y"
    const totalPages = pdfDoc.getPageCount();
    if (totalPages > 0) {
      const footerFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      for (let i = 0; i < totalPages; i += 1) {
        const page = pdfDoc.getPage(i);
        const label = `Page ${i + 1} of ${totalPages}`;
        const size = 10;
        const textWidth = footerFont.widthOfTextAtSize(label, size);
        const x = (LETTER_WIDTH - textWidth) / 2;
        const y = 18; // ~0.25in from bottom
        page.drawText(label, { x, y, size, font: footerFont, color: rgb(0.28, 0.32, 0.37) });
      }
    }

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'combined.pdf';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [fragments, headingSettings, docDate]);

  const previewFragments = useMemo(
    () =>
      fragments.map((fragment) => (
        <React.Fragment key={fragment.id}>
          {fragment.type === 'markdown' ? (
            <div className="fragment-wrapper">
              <div className="fragment-toolbar">
                <button
                  type="button"
                  className="ghost"
                  title="Fullscreen"
                  onClick={() => setFullscreenFragmentId(fragment.id)}
                >
                  ⤢ Fullscreen
                </button>
              </div>
              <PaginatedMarkdown content={fragment.content} heading={headingSettings} title={fragment.title} docDate={docDate} />
            </div>
          ) : (
            <PdfPreview data={fragment.data} />
          )}
        </React.Fragment>
      )),
    [fragments, headingSettings, docDate],
  );

  return (
    <div className="app-shell">
      <aside className="editor-panel">
        <h1>Document Builder</h1>
        <p className="lead">
          Assemble Markdown notes and PDFs into a single, print-ready packet. Add new fragments
          below and fine-tune their order.
        </p>

        <div className="card">
          <label htmlFor="doc-date-input">Document date (applies to all sections)</label>
          <input
            id="doc-date-input"
            type="date"
            className="heading-input"
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
          />
        </div>

        <div className={`card heading-card${headingExpanded ? ' expanded' : ''}`}>
          <button
            type="button"
            className="heading-toggle"
            onClick={() => setHeadingExpanded((current) => !current)}
            aria-expanded={headingExpanded}
          >
            <span>Pleading heading</span>
            <span className="heading-toggle-icon">{headingExpanded ? '−' : '+'}</span>
          </button>
          {headingExpanded && (
            <div className="heading-editor">
              <HeadingFieldList
                label="Left-side contact lines"
                fields={leftHeadingFields}
                onAdd={handleAddLeftField}
                onRemove={handleRemoveLeftField}
                onChange={handleLeftFieldChange}
              />

              <div className="heading-party-grid">
                <div className="heading-party-field">
                  <label className="heading-label" htmlFor="plaintiff-input">
                    Plaintiff name
                  </label>
                  <input
                    id="plaintiff-input"
                    type="text"
                    value={plaintiffName}
                    onChange={(event) => setPlaintiffName(event.target.value)}
                    className="heading-input"
                  />
                </div>
                <div className="heading-party-field">
                  <label className="heading-label" htmlFor="defendant-input">
                    Defendant name
                  </label>
                  <input
                    id="defendant-input"
                    type="text"
                    value={defendantName}
                    onChange={(event) => setDefendantName(event.target.value)}
                    className="heading-input"
                  />
                </div>
              </div>

              <HeadingFieldList
                label="Right-side caption details"
                fields={rightHeadingFields}
                onAdd={handleAddRightField}
                onRemove={handleRemoveRightField}
                onChange={handleRightFieldChange}
              />

              <label className="heading-label" htmlFor="court-title-input">Court/Venue title</label>
              <input
                id="court-title-input"
                type="text"
                value={courtTitle}
                onChange={(event) => setCourtTitle(event.target.value)}
                className="heading-input"
                placeholder="e.g., COUNTY OF SAN BERNARDINO"
              />
            </div>
          )}
        </div>

        <form onSubmit={handleMarkdownSubmit} className="card">
          <label className="heading-label" htmlFor="entry-title-input">Section title</label>
          <input
            id="entry-title-input"
            type="text"
            value={markdownTitleDraft}
            onChange={(event) => setMarkdownTitleDraft(event.target.value)}
            className="heading-input"
            placeholder="e.g., Introduction"
          />

          <div className="label-row">
            <label htmlFor="markdown-input">Markdown fragment</label>
            <button
              type="button"
              className="ghost small"
              onClick={() => setIsDraftEditorOpen(true)}
              aria-label="Open fullscreen editor for draft"
            >
              Fullscreen
            </button>
          </div>
          <textarea
            id="markdown-input"
            className="markdown-input"
            placeholder="## Title\n\nDraft your content here..."
            value={markdownDraft}
            onChange={(event) => setMarkdownDraft(event.target.value)}
            rows={8}
          />
          <button type="submit" className="primary">
            Add Markdown
          </button>
        </form>

        <div className="card">
          <label htmlFor="pdf-input">Attach PDF</label>
          <input
            id="pdf-input"
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
          />
          <p className="help-text">
            Uploaded PDFs keep their original pagination. Multi-page documents are supported.
          </p>
        </div>

        <FragmentList
          fragments={fragments}
          onChangeContent={handleFragmentContentChange}
          onChangeTitle={handleFragmentTitleChange}
          onMove={handleMoveFragment}
          onRemove={handleRemoveFragment}
          onOpenEditor={setEditingFragmentId}
        />
      </aside>

      <main className="preview-panel">
        <div className="toolbar">
          <button type="button" onClick={handlePrint} className="secondary">
            Print or Save as PDF
          </button>
          <button type="button" onClick={handleCompilePdf} className="primary">
            Download Combined PDF
          </button>
        </div>
        <div className="preview-scroll" ref={previewRef}>
          {previewFragments.length ? (
            previewFragments
          ) : (
            <div className="empty-state">
              <p>Add Markdown or upload a PDF to begin building your packet.</p>
            </div>
          )}
        </div>
      </main>
      {/* Fullscreen overlay for markdown previews */}
      {fullscreenFragmentId && (
        <FullscreenOverlay onClose={() => setFullscreenFragmentId(null)}>
          {(() => {
            const frag = fragments.find((f) => f.id === fullscreenFragmentId);
            if (!frag || frag.type !== 'markdown') return null;
            return (
              <div className="fullscreen-content-inner">
                <PaginatedMarkdown content={frag.content} heading={headingSettings} title={frag.title} docDate={docDate} />
              </div>
            );
          })()}
        </FullscreenOverlay>
      )}
      {editingFragmentId && (
        <EditorOverlay
          fragment={fragments.find((f) => f.id === editingFragmentId)}
          onClose={() => setEditingFragmentId(null)}
          onSave={(updated) => {
            setFragments((current) =>
              current.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)),
            );
            setEditingFragmentId(null);
          }}
        />
      )}
      {isDraftEditorOpen && (
        <FullscreenOverlay onClose={() => setIsDraftEditorOpen(false)}>
          <div className="editor-fullscreen-container">
            <div className="editor-fullscreen-header">
              <h3>New Markdown Entry</h3>
              <div className="editor-fullscreen-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setIsDraftEditorOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="editor-fullscreen-form">
              <input
                type="text"
                className="heading-input editor-fullscreen-title"
                placeholder="Entry title"
                value={markdownTitleDraft}
                onChange={(e) => setMarkdownTitleDraft(e.target.value)}
              />
              <textarea
                className="markdown-editor editor-fullscreen-textarea"
                placeholder="## Title\n\nDraft your content here..."
                value={markdownDraft}
                onChange={(e) => setMarkdownDraft(e.target.value)}
              />
            </div>
          </div>
        </FullscreenOverlay>
      )}
    </div>
  );
}

// Fullscreen overlay component
function FullscreenOverlay({ onClose, children }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onBackdrop = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="fullscreen-overlay" ref={overlayRef} onMouseDown={onBackdrop}>
      <div className="fullscreen-header">
        <div className="fullscreen-spacer" />
        <button type="button" className="fullscreen-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="fullscreen-body">
        {children}
      </div>
    </div>
  );
}

// Fullscreen editor for an existing markdown fragment
function EditorOverlay({ fragment, onClose, onSave }) {
  const [title, setTitle] = useState(fragment?.title || '');
  const [content, setContent] = useState(fragment?.content || '');

  if (!fragment || fragment.type !== 'markdown') return null;

  return (
    <FullscreenOverlay onClose={onClose}>
      <div className="editor-fullscreen-container">
        <div className="editor-fullscreen-header">
          <h3>Edit Markdown Entry</h3>
          <div className="editor-fullscreen-actions">
            <button
              type="button"
              className="secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => onSave && onSave({ id: fragment.id, title: title?.trim() || 'Untitled', content })}
            >
              Save
            </button>
          </div>
        </div>
        <div className="editor-fullscreen-form">
          <input
            type="text"
            className="heading-input editor-fullscreen-title"
            placeholder="Entry title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="markdown-editor editor-fullscreen-textarea"
            placeholder="## Title\n\nDraft your content here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>
    </FullscreenOverlay>
  );
}
