'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const CARET_PIXEL_OFFSET = 0.75;
const FLOAT_TOLERANCE = 0.01;

const MARKDOWN_COMPONENT_OVERRIDES = {
  table: (props) => <table className="md-table" {...props} />,
  th: (props) => <th className="md-table-cell" {...props} />,
  td: (props) => <td className="md-table-cell" {...props} />,
};

const hasVisualContent = (element) => {
  if (!element) return false;
  if (['HR'].includes(element.tagName)) return true;
  if (element.textContent && element.textContent.trim()) return true;
  return Boolean(element.querySelector('img, table, code, pre, iframe, video, svg')); // embedded visuals or code
};

// Convert a DOM Range fragment back into an HTML string wrapped by the
// provided element (without mutating the original element instance).
function wrapFragmentHtml(element, fragment) {
  const wrapper = element.cloneNode(false);
  wrapper.appendChild(fragment);
  return wrapper;
}

function getCaretFromPoint(x, y) {
  if (document.caretPositionFromPoint) {
    return document.caretPositionFromPoint(x, y);
  }
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y);
  }
  return null;
}

function computeLinesForNode(measurementHost, node, lineHeight) {
  measurementHost.innerHTML = '';
  measurementHost.appendChild(node);
  const rect = node.getBoundingClientRect();
  const styles = window.getComputedStyle(node);
  const marginTop = parseFloat(styles.marginTop) || 0;
  const marginBottom = parseFloat(styles.marginBottom) || 0;
  const totalHeight = rect.height + marginTop + marginBottom;
  const lines = Math.max(1, Math.ceil((totalHeight - FLOAT_TOLERANCE) / lineHeight));
  measurementHost.removeChild(node);
  return lines;
}

function splitNodeByLines(measurementHost, node, allowedLines, lineHeight, bodyRect) {
  measurementHost.innerHTML = '';
  measurementHost.appendChild(node);

  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0);
  if (!rects.length) {
    measurementHost.removeChild(node);
    return { head: node, tail: null };
  }

  const targetRect = rects[Math.min(rects.length - 1, allowedLines - 1)];
  const xCandidate = Math.min(targetRect.right - CARET_PIXEL_OFFSET, bodyRect.right - CARET_PIXEL_OFFSET);
  const x = clampNumber(xCandidate, targetRect.left + CARET_PIXEL_OFFSET, bodyRect.right - CARET_PIXEL_OFFSET);
  const y = clampNumber(targetRect.bottom - CARET_PIXEL_OFFSET, bodyRect.top + CARET_PIXEL_OFFSET, bodyRect.bottom - CARET_PIXEL_OFFSET);

  const caretPosition = getCaretFromPoint(x, y);
  if (!caretPosition) {
    measurementHost.removeChild(node);
    return { head: node, tail: null };
  }

  const caretNode = caretPosition.offsetNode || caretPosition.startContainer;
  const caretOffset = caretPosition.offset !== undefined ? caretPosition.offset : caretPosition.startOffset;

  const headRange = document.createRange();
  headRange.setStart(node, 0);
  headRange.setEnd(caretNode, caretOffset);

  const tailRange = document.createRange();
  tailRange.setStart(caretNode, caretOffset);
  tailRange.setEnd(node, node.childNodes.length);

  const headFragment = headRange.cloneContents();
  const tailFragment = tailRange.cloneContents();

  const headWrapper = wrapFragmentHtml(node, headFragment);
  const tailWrapper = wrapFragmentHtml(node, tailFragment);

  const originalStyles = window.getComputedStyle(node);
  headWrapper.style.marginBottom = '0';
  tailWrapper.style.marginTop = '0';
  tailWrapper.style.marginBottom = originalStyles.marginBottom;

  if (node.tagName === 'OL') {
    const startValue = parseInt(node.getAttribute('start') || '1', 10);
    if (caretNode === node) {
      const offsetIndex = caretOffset;
      if (Number.isInteger(offsetIndex)) {
        tailWrapper.setAttribute('start', startValue + offsetIndex);
      }
    }
  }

  measurementHost.removeChild(node);
  return { head: headWrapper, tail: tailWrapper };
}

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate }) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    if (!measurerRef.current) return undefined;

    const root = measurerRef.current;
    const firstContainer = root.querySelector('[data-page-type="first"]');
    const continuationContainer = root.querySelector('[data-page-type="continuation"]');
    if (!firstContainer || !continuationContainer) return undefined;

    const firstMain = firstContainer.querySelector('.pleading-main');
    const firstBody = firstContainer.querySelector('.pleading-body');
    const continuationMain = continuationContainer.querySelector('.pleading-main');
    const continuationBody = continuationContainer.querySelector('.pleading-body');

    if (!firstMain || !firstBody || !continuationMain || !continuationBody) return undefined;

    let cancelled = false;

    const recomputePages = () => {
      if (cancelled) return;
      const nodes = Array.from(firstBody.children)
        .filter((child) => child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR' && hasVisualContent(child))
        .map((child) => child.cloneNode(true));

      const styles = window.getComputedStyle(firstBody);
      const lineHeight = parseFloat(styles.lineHeight);
      if (!lineHeight || Number.isNaN(lineHeight)) {
        setPages([]);
        return;
      }

      const firstMainRect = firstMain.getBoundingClientRect();
      const firstBodyRect = firstBody.getBoundingClientRect();
      const continuationMainRect = continuationMain.getBoundingClientRect();
      const continuationBodyRect = continuationBody.getBoundingClientRect();

      const firstAvailableLines = Math.max(
        1,
        Math.floor((firstMainRect.height - (firstBodyRect.top - firstMainRect.top)) / lineHeight),
      );
      const otherAvailableLines = Math.max(
        1,
        Math.floor((continuationMainRect.height - (continuationBodyRect.top - continuationMainRect.top)) / lineHeight),
      );

      const measurementHost = document.createElement('div');
      measurementHost.className = firstBody.className;
      measurementHost.style.position = 'absolute';
      measurementHost.style.visibility = 'hidden';
      measurementHost.style.pointerEvents = 'none';
      measurementHost.style.left = '0';
      measurementHost.style.top = '0';
      measurementHost.style.width = `${firstBodyRect.width}px`;
      measurementHost.style.display = styles.display;
      measurementHost.style.flexDirection = styles.flexDirection;
      measurementHost.style.gap = styles.gap;
      measurementHost.style.font = styles.font;
      measurementHost.style.lineHeight = styles.lineHeight;
      firstMain.appendChild(measurementHost);

      const pagesHtml = [];
      let currentParts = [];
      let remainingLines = firstAvailableLines;

      const pushPage = () => {
        pagesHtml.push(currentParts.join(''));
        currentParts = [];
        remainingLines = otherAvailableLines;
      };

      const bodyRect = firstBodyRect;

      const queue = [...nodes];

      while (queue.length) {
        let node = queue.shift();
        const lines = computeLinesForNode(measurementHost, node, lineHeight);

        if (lines <= remainingLines) {
          currentParts.push(node.outerHTML);
          remainingLines -= lines;
          if (remainingLines <= 0 && queue.length) {
            pushPage();
          }
          continue;
        }

        if (remainingLines <= 0) {
          pushPage();
          queue.unshift(node);
          continue;
        }

        const splitResult = splitNodeByLines(measurementHost, node, remainingLines, lineHeight, bodyRect);
        const { head, tail } = splitResult;

        if (!head || head === node) {
          // Failed to split; move entire node to next page to avoid infinite loops
          pushPage();
          queue.unshift(node);
          continue;
        }

        const headLines = computeLinesForNode(measurementHost, head, lineHeight);
        currentParts.push(head.outerHTML);
        remainingLines -= headLines;

        if (tail && hasVisualContent(tail)) {
          queue.unshift(tail);
        }

        if (remainingLines <= 0 && queue.length) {
          pushPage();
        }
      }

      if (currentParts.length || !pagesHtml.length) {
        pagesHtml.push(currentParts.join(''));
      }

      measurementHost.remove();
      setPages(pagesHtml);
    };

    const schedule = () => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(recomputePages);
      });
    };

    schedule();

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(firstBody);
    resizeObserver.observe(firstMain);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [content, heading, title, docDate]);

  const renderedPages = useMemo(() => {
    if (!pages.length) {
      return [''];
    }
    return pages;
  }, [pages]);

  // Render hidden measurer and visible pages
  return (
    <>
      <div ref={measurerRef} className="page-measurer" aria-hidden style={{ position: 'absolute', inset: '-10000px auto auto -10000px' }}>
        <div data-page-type="first">
          <PleadingPage heading={heading} title={title} firstPage pageNumber={1} totalPages={2} docDate={docDate}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENT_OVERRIDES}>
              {content || ''}
            </ReactMarkdown>
          </PleadingPage>
        </div>
        <div data-page-type="continuation">
          <PleadingPage heading={heading} title={title} firstPage={false} pageNumber={1} totalPages={2} docDate={docDate}>
            <div />
          </PleadingPage>
        </div>
      </div>
      {renderedPages.map((html, pageIndex) => (
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
            totalPages={renderedPages.length}
            docDate={docDate}
          >
            <div className="markdown-body-fragment" dangerouslySetInnerHTML={{ __html: html }} />
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
