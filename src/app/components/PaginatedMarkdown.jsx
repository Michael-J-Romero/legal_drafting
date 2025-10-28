'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

const LINE_LIMIT = 28;
const HEIGHT_TOLERANCE = 0.5;
const ATOMIC_TAGS = new Set(['TABLE', 'IMG', 'SVG', 'VIDEO', 'IFRAME', 'OBJECT', 'EMBED', 'PRE', 'CODE', 'CANVAS']);

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isIgnorableNode(node) {
  if (!node) return true;
  if (node.nodeType === Node.COMMENT_NODE) return true;
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').trim().length === 0;
  }
  return false;
}

function hasMeaningfulContent(node) {
  if (!node) return false;
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').trim().length > 0;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.nodeName === 'BR') return true;
    const children = Array.from(node.childNodes || []);
    return children.some((child) => hasMeaningfulContent(child));
  }
  return false;
}

function countCharacters(node) {
  if (!node) return 0;
  let total = 0;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    total += (walker.currentNode.textContent || '').length;
  }
  return total;
}

function collectBreakpoints(node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  const positions = [];
  let count = 0;
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent || '';
    for (let i = 0; i < text.length; i += 1) {
      count += 1;
      if (/\s/.test(text[i])) {
        positions.push(count);
      }
    }
  }
  const unique = Array.from(new Set(positions.filter((value) => value > 0 && value < count))).sort((a, b) => a - b);
  return { total: count, breakpoints: unique };
}

function cloneFirstCharacters(node, charCount) {
  if (!node || charCount <= 0) {
    if (!node) {
      return { head: null, tail: null, used: 0 };
    }
    return { head: null, tail: node.cloneNode(true), used: 0 };
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (charCount >= text.length) {
      return { head: document.createTextNode(text), tail: null, used: text.length };
    }
    const headText = text.slice(0, charCount);
    const tailText = text.slice(charCount);
    return {
      head: headText ? document.createTextNode(headText) : null,
      tail: tailText ? document.createTextNode(tailText) : null,
      used: Math.min(charCount, text.length),
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return { head: null, tail: null, used: 0 };
  }

  if (ATOMIC_TAGS.has(node.nodeName)) {
    const totalChars = countCharacters(node);
    if (charCount >= totalChars) {
      return { head: node.cloneNode(true), tail: null, used: totalChars };
    }
    return { head: null, tail: node.cloneNode(true), used: 0 };
  }

  const headClone = node.cloneNode(false);
  const tailClone = node.cloneNode(false);
  let remaining = charCount;
  let usedTotal = 0;

  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (remaining <= 0) {
        if (text.length) tailClone.appendChild(document.createTextNode(text));
        return;
      }
      if (remaining >= text.length) {
        if (text.length) headClone.appendChild(document.createTextNode(text));
        remaining -= text.length;
        usedTotal += text.length;
        return;
      }
      const headText = text.slice(0, remaining);
      const tailText = text.slice(remaining);
      if (headText) headClone.appendChild(document.createTextNode(headText));
      if (tailText) tailClone.appendChild(document.createTextNode(tailText));
      usedTotal += remaining;
      remaining = 0;
      return;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      if (remaining <= 0) {
        tailClone.appendChild(child.cloneNode(true));
        return;
      }
      if (child.nodeName === 'BR') {
        if (remaining > 0) {
          headClone.appendChild(child.cloneNode(true));
        } else {
          tailClone.appendChild(child.cloneNode(true));
        }
        return;
      }
      const { head, tail, used } = cloneFirstCharacters(child, remaining);
      remaining -= used;
      usedTotal += used;
      if (head) headClone.appendChild(head);
      if (tail) tailClone.appendChild(tail);
      return;
    }

    const clone = child.cloneNode(true);
    if (remaining > 0) {
      headClone.appendChild(clone);
    } else {
      tailClone.appendChild(clone);
    }
  });

  if (remaining > 0) {
    return { head: node.cloneNode(true), tail: null, used: usedTotal };
  }

  const headResult = hasMeaningfulContent(headClone) ? headClone : null;
  const tailResult = hasMeaningfulContent(tailClone) ? tailClone : null;
  return { head: headResult, tail: tailResult, used: charCount };
}

function serializeNodes(nodes) {
  return nodes
    .map((node) => {
      if (!node) return '';
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      return node.outerHTML || '';
    })
    .join('');
}

function computeBodyLimit(mainEl, bodyEl) {
  if (!mainEl || !bodyEl) return 0;
  const footer = mainEl.querySelector('.page-footer');
  const mainRect = mainEl.getBoundingClientRect();
  const bodyRect = bodyEl.getBoundingClientRect();
  const footerRect = footer ? footer.getBoundingClientRect() : { top: mainRect.bottom };
  return footerRect.top - bodyRect.top;
}

function createPhantom(bodyEl) {
  if (!bodyEl || !document?.body) return null;
  const phantom = bodyEl.cloneNode(false);
  const computed = window.getComputedStyle(bodyEl);
  phantom.style.position = 'absolute';
  phantom.style.visibility = 'hidden';
  phantom.style.pointerEvents = 'none';
  phantom.style.left = '-10000px';
  phantom.style.top = '0';
  phantom.style.height = 'auto';
  phantom.style.minHeight = '0';
  phantom.style.maxHeight = 'none';
  phantom.style.margin = '0';
  phantom.style.border = 'none';
  phantom.style.padding = computed.padding;
  phantom.style.boxSizing = computed.boxSizing;
  phantom.style.width = `${bodyEl.getBoundingClientRect().width}px`;
  document.body.appendChild(phantom);
  return phantom;
}

function attemptSplitWithCandidates(node, candidates, limit, phantom) {
  if (!candidates.length) return null;
  let low = 0;
  let high = candidates.length - 1;
  let best = null;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const count = candidates[mid];
    if (!count || count < 0) {
      low = mid + 1;
      continue;
    }
    const { head, tail } = cloneFirstCharacters(node, count);
    if (!head) {
      high = mid - 1;
      continue;
    }
    const measureNode = head.cloneNode(true);
    phantom.appendChild(measureNode);
    const totalHeight = phantom.getBoundingClientRect().height;
    const fits = totalHeight <= limit + HEIGHT_TOLERANCE;
    phantom.removeChild(measureNode);
    if (fits) {
      best = { head, tail };
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function splitNodeToHeight(node, limit, phantom) {
  if (!node || !phantom) return null;
  if (node.nodeType === Node.ELEMENT_NODE && ATOMIC_TAGS.has(node.nodeName)) {
    return null;
  }
  const { total, breakpoints } = collectBreakpoints(node);
  if (total === 0) return null;

  let best = attemptSplitWithCandidates(node, breakpoints, limit, phantom);
  if (!best) {
    const fallback = Array.from({ length: total }, (_, idx) => idx + 1);
    best = attemptSplitWithCandidates(node, fallback, limit, phantom);
  }
  if (!best || !best.head) return null;
  const measureNode = best.head.cloneNode(true);
  const remainingNode = best.tail && hasMeaningfulContent(best.tail) ? best.tail : null;
  return {
    measureNode,
    outputNode: best.head,
    remainingNode,
  };
}

function buildPages(firstWrapper, standardWrapper) {
  if (!firstWrapper || !standardWrapper) return [''];
  const firstMain = firstWrapper.querySelector('.pleading-main');
  const firstBody = firstWrapper.querySelector('.pleading-body');
  const standardMain = standardWrapper.querySelector('.pleading-main');
  const standardBody = standardWrapper.querySelector('.pleading-body');
  if (!firstMain || !firstBody || !standardMain || !standardBody) return [''];

  const bodyStyle = window.getComputedStyle(firstBody);
  const lineHeight = parseFloat(bodyStyle.lineHeight) || 0;
  const maxHeight = lineHeight > 0 ? lineHeight * LINE_LIMIT : Number.POSITIVE_INFINITY;
  let firstLimit = computeBodyLimit(firstMain, firstBody);
  let fullLimit = computeBodyLimit(standardMain, standardBody);
  if (Number.isFinite(maxHeight)) {
    firstLimit = Math.min(firstLimit, maxHeight);
    fullLimit = Math.min(fullLimit, maxHeight);
  }
  if (!Number.isFinite(firstLimit) || !Number.isFinite(fullLimit) || firstLimit <= 0 || fullLimit <= 0) {
    return [''];
  }

  const rawNodes = Array.from(firstBody.childNodes).map((node) => node.cloneNode(true));
  const queue = rawNodes.filter((node) => !isIgnorableNode(node));
  const pages = [];
  let pageNodes = [];
  let currentLimit = firstLimit;
  const phantom = createPhantom(firstBody);
  if (!phantom) return [''];

  const flushPage = (force = false) => {
    if (!pageNodes.length && !force && pages.length) {
      phantom.innerHTML = '';
      currentLimit = fullLimit;
      return;
    }
    pages.push(serializeNodes(pageNodes));
    pageNodes = [];
    phantom.innerHTML = '';
    currentLimit = fullLimit;
  };

  try {
    if (!queue.length) {
      flushPage(true);
      return pages;
    }

    while (queue.length) {
      const currentNode = queue.shift();
      const measurementNode = currentNode.cloneNode(true);
      phantom.appendChild(measurementNode);
      const totalHeight = phantom.getBoundingClientRect().height;

      if (totalHeight <= currentLimit + HEIGHT_TOLERANCE) {
        pageNodes.push(currentNode);
        continue;
      }

      phantom.removeChild(measurementNode);
      const beforeHeight = phantom.getBoundingClientRect().height;
      const availableHeight = currentLimit - beforeHeight;

      if (availableHeight <= HEIGHT_TOLERANCE) {
        if (pageNodes.length) {
          flushPage();
          queue.unshift(currentNode);
          continue;
        }
      }

      const splitResult = splitNodeToHeight(currentNode, currentLimit, phantom);
      if (splitResult) {
        phantom.appendChild(splitResult.measureNode);
        pageNodes.push(splitResult.outputNode);
        flushPage();
        if (splitResult.remainingNode) {
          queue.unshift(splitResult.remainingNode);
        }
        continue;
      }

      if (pageNodes.length) {
        flushPage();
        queue.unshift(currentNode);
        continue;
      }

      // Fallback: place the node alone on a fresh page to avoid infinite loops
      phantom.appendChild(currentNode.cloneNode(true));
      pageNodes.push(currentNode);
      flushPage();
    }

    if (pageNodes.length) {
      flushPage();
    }

    if (!pages.length) {
      flushPage(true);
    }

    return pages;
  } finally {
    if (phantom.parentNode) {
      phantom.parentNode.removeChild(phantom);
    }
  }
}

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate, pageOffset = 0, totalOverride = null, hideHeader = false, preTitleCaptions = [], suppressTitlePlaceholder = false, onPageCount, disableSignature = false }) {
  const firstMeasureRef = useRef(null);
  const standardMeasureRef = useRef(null);
  const [pages, setPages] = useState([]);

  const markdownContent = useMemo(() => content || '', [content]);

  useLayoutEffect(() => {
    const firstWrapper = firstMeasureRef.current;
    const standardWrapper = standardMeasureRef.current;
    if (!firstWrapper || !standardWrapper) return undefined;

    let frame = null;
    const recompute = () => {
      frame = null;
      const computedPages = buildPages(firstWrapper, standardWrapper);
      setPages((prev) => (arraysEqual(prev, computedPages) ? prev : computedPages));
    };

    recompute();

    const observer = new ResizeObserver(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    });

    observer.observe(firstWrapper);
    observer.observe(standardWrapper);
    const firstBody = firstWrapper.querySelector('.pleading-body');
    const standardBody = standardWrapper.querySelector('.pleading-body');
    if (firstBody) observer.observe(firstBody);
    if (standardBody) observer.observe(standardBody);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [markdownContent, heading, title, hideHeader, preTitleCaptions, suppressTitlePlaceholder]);

  useEffect(() => {
    try {
      if (typeof onPageCount === 'function') {
        onPageCount(Array.isArray(pages) ? pages.length : 0);
      }
    } catch (_) {}
  }, [onPageCount, pages.length]);

  return (
    <>
      <div
        aria-hidden
        style={{ position: 'absolute', inset: '-10000px auto auto -10000px', width: '8.5in' }}
      >
        <div ref={firstMeasureRef} className="page-measurer first-measure">
          <PleadingPage
            heading={heading}
            title={title}
            firstPage
            pageNumber={1}
            totalPages={1}
            docDate={docDate}
            hideHeaderBlocks={hideHeader}
            preTitleCaptions={preTitleCaptions}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={false}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: (props) => <table className="md-table" {...props} />,
                th: (props) => <th className="md-table-cell" {...props} />,
                td: (props) => <td className="md-table-cell" {...props} />,
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          </PleadingPage>
        </div>
        <div ref={standardMeasureRef} className="page-measurer standard-measure">
          <PleadingPage
            heading={heading}
            title={title}
            firstPage={false}
            pageNumber={1}
            totalPages={1}
            docDate={docDate}
            hideHeaderBlocks={hideHeader}
            preTitleCaptions={preTitleCaptions}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={false}
          >
            <div />
          </PleadingPage>
        </div>
      </div>
      {pages.map((html, pageIndex) => (
        <div className="page-wrapper" key={`md-page-${pageIndex}`}>
          <button
            type="button"
            className="fullscreen-toggle"
            title="Fullscreen"
            onClick={() => {}}
          >
            ⤢
          </button>
          <PleadingPage
            heading={heading}
            title={title}
            firstPage={pageIndex === 0}
            hideHeaderBlocks={hideHeader}
            preTitleCaptions={preTitleCaptions}
            pageNumber={pageOffset + pageIndex + 1}
            totalPages={typeof totalOverride === 'number' ? totalOverride : (pageOffset + pages.length)}
            docDate={docDate}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={disableSignature ? false : (pageIndex === pages.length - 1)}
            bodyHtml={html}
          />
        </div>
      ))}
    </>
  );
}
