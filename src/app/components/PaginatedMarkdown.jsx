
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

const MARKDOWN_COMPONENTS = {
  table: (props) => <table className="md-table" {...props} />,
  th: (props) => <th className="md-table-cell" {...props} />,
  td: (props) => <td className="md-table-cell" {...props} />,
};

const MAX_LINES_PER_PAGE = 28;
const HEIGHT_TOLERANCE = 0.75; // allow sub-pixel rounding wiggle room when comparing heights

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

const getTextNodes = (root) => {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let current = walker.nextNode();
  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }
  return nodes;
};

const textLength = (node) => {
  if (!node) return 0;
  return getTextNodes(node).reduce((sum, textNode) => sum + textNode.textContent.length, 0);
};

const removeFollowingSiblings = (node, root) => {
  let current = node;
  while (current && current !== root) {
    let sibling = current.nextSibling;
    while (sibling) {
      const next = sibling.nextSibling;
      sibling.parentNode.removeChild(sibling);
      sibling = next;
    }
    current = current.parentNode;
  }
};

const removePreviousSiblings = (node, root) => {
  let current = node;
  while (current && current !== root) {
    let sibling = current.previousSibling;
    while (sibling) {
      const prev = sibling.previousSibling;
      sibling.parentNode.removeChild(sibling);
      sibling = prev;
    }
    current = current.parentNode;
  }
};

const cleanupEmpty = (node, isRoot = true) => {
  if (!node) return true;

  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent.length === 0) return true;
    if (node.textContent.trim().length === 0) {
      node.textContent = '';
      return true;
    }
    return false;
  }

  const children = Array.from(node.childNodes);
  children.forEach((child) => {
    if (cleanupEmpty(child, false)) {
      node.removeChild(child);
    }
  });

  if (node.tagName === 'BR') return false;

  if (!isRoot && node.childNodes.length === 0) {
    return true;
  }

  if (
    !isRoot &&
    node.childNodes.length === 1 &&
    node.firstChild.nodeType === Node.TEXT_NODE &&
    node.firstChild.textContent.trim().length === 0
  ) {
    node.removeChild(node.firstChild);
    return true;
  }

  return false;
};

const cloneNodeWithLimit = (node, limit) => {
  if (limit <= 0) return null;
  const clone = node.cloneNode(true);
  const textNodes = getTextNodes(clone);
  let remaining = limit;
  let cutIndex = -1;

  for (let i = 0; i < textNodes.length; i += 1) {
    const textNode = textNodes[i];
    const len = textNode.textContent.length;
    if (remaining >= len) {
      remaining -= len;
      continue;
    }
    const keep = Math.max(remaining, 0);
    textNode.textContent = keep > 0 ? textNode.textContent.slice(0, keep) : '';
    cutIndex = i;
    removeFollowingSiblings(textNode, clone);
    remaining = 0;
    break;
  }

  if (remaining > 0) {
    cleanupEmpty(clone);
    return textLength(clone) === 0 ? null : clone;
  }

  if (cutIndex >= 0) {
    for (let j = cutIndex + 1; j < textNodes.length; j += 1) {
      textNodes[j].textContent = '';
    }
  }

  cleanupEmpty(clone);
  return textLength(clone) === 0 ? null : clone;
};

const cloneNodeFromOffset = (node, offset) => {
  const total = textLength(node);
  if (offset <= 0) return node.cloneNode(true);
  if (offset >= total) return null;

  const clone = node.cloneNode(true);
  const textNodes = getTextNodes(clone);
  let remaining = offset;

  for (let i = 0; i < textNodes.length; i += 1) {
    const textNode = textNodes[i];
    const len = textNode.textContent.length;
    if (remaining >= len) {
      removePreviousSiblings(textNode, clone);
      textNode.textContent = '';
      remaining -= len;
      continue;
    }

    textNode.textContent = textNode.textContent.slice(remaining);
    removePreviousSiblings(textNode, clone);
    remaining = 0;
    break;
  }

  cleanupEmpty(clone);
  return textLength(clone) === 0 ? null : clone;
};

const splitNodeByCharacters = (node, count) => {
  const total = textLength(node);
  if (total === 0) {
    return { head: null, tail: null };
  }

  const safeCount = Math.max(0, Math.min(total, count));
  const head = safeCount > 0 ? cloneNodeWithLimit(node, safeCount) : null;
  const tail = safeCount < total ? cloneNodeFromOffset(node, safeCount) : null;
  return { head, tail };
};

const normalizeBlock = (node) => {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
  const tables = node.matches('table') ? [node] : Array.from(node.querySelectorAll('table'));
  tables.forEach((table) => {
    table.classList.add('md-table');
  });
  const ths = node.matches('th') ? [node] : Array.from(node.querySelectorAll('th'));
  ths.forEach((th) => th.classList.add('md-table-cell'));
  const tds = node.matches('td') ? [node] : Array.from(node.querySelectorAll('td'));
  tds.forEach((td) => td.classList.add('md-table-cell'));
};

const markContinuation = (node) => {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
  if (node.tagName === 'LI') {
    node.setAttribute('data-continued', 'true');
    return;
  }
  const firstItem = node.querySelector('li');
  if (firstItem) {
    firstItem.setAttribute('data-continued', 'true');
  }
};

const paginateNodes = (nodes, body, { pageHeight, lineHeight }) => {
  const queue = nodes
    .map((node) => node.cloneNode(true))
    .filter((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim().length > 0;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      if (node.tagName === 'BR') return false;
      return true;
    });

  const pages = [];
  body.innerHTML = '';
  let currentHeight = 0;

  const flushPage = (force = false) => {
    const html = body.innerHTML;
    if (force || html.trim().length > 0 || pages.length === 0) {
      pages.push(html);
    }
    body.innerHTML = '';
    currentHeight = 0;
  };

  while (queue.length) {
    let node = queue.shift();
    if (!node) continue;

    if (node.nodeType === Node.TEXT_NODE) {
      const wrapper = document.createElement('p');
      wrapper.textContent = node.textContent;
      node = wrapper;
    }

    normalizeBlock(node);
    body.appendChild(node);
    const newHeight = body.getBoundingClientRect().height;

    if (newHeight <= pageHeight + HEIGHT_TOLERANCE) {
      currentHeight = newHeight;
      if (queue.length === 0) {
        flushPage();
      }
      continue;
    }

    body.removeChild(node);
    const available = pageHeight - currentHeight;

    if (available <= HEIGHT_TOLERANCE) {
      flushPage();
      queue.unshift(node);
      continue;
    }

    const totalChars = textLength(node);

    if (totalChars === 0) {
      // Non-text block (e.g., table). Move to next page to avoid overflow.
      flushPage();
      body.appendChild(node);
      currentHeight = body.getBoundingClientRect().height;
      flushPage();
      continue;
    }

    let low = 1;
    let high = totalChars;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = cloneNodeWithLimit(node, mid);
      if (!candidate) {
        high = mid - 1;
        continue;
      }
      normalizeBlock(candidate);
      body.appendChild(candidate);
      const testHeight = body.getBoundingClientRect().height;
      body.removeChild(candidate);

      if (testHeight <= pageHeight + HEIGHT_TOLERANCE) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (best <= 0) {
      body.appendChild(node);
      const blockHeight = body.getBoundingClientRect().height - currentHeight;
      body.removeChild(node);
      const estimatedLines = Math.max(1, Math.round(blockHeight / Math.max(lineHeight, 1)));
      best = Math.max(1, Math.floor(totalChars / estimatedLines));
    }

    const { head, tail } = splitNodeByCharacters(node, best);

    if (head) {
      normalizeBlock(head);
      body.appendChild(head);
      currentHeight = body.getBoundingClientRect().height;
    }

    flushPage();

    if (tail) {
      normalizeBlock(tail);
      markContinuation(tail);
      queue.unshift(tail);
    }
  }

  if (body.innerHTML.trim().length > 0) {
    flushPage();
  }

  if (!pages.length) pages.push('');
  return pages;
};

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate, pageOffset = 0, totalOverride = null, hideHeader = false, preTitleCaptions = [], suppressTitlePlaceholder = false, onPageCount, disableSignature = false }) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!measurerRef.current) return () => {
      cancelled = true;
    };

    const root = measurerRef.current;
    const main = root.querySelector('.pleading-main');
    const body = root.querySelector('.pleading-body');
    if (!main || !body) return () => {
      cancelled = true;
    };

    setPages([]);

    const run = async () => {
      const computed = window.getComputedStyle(body);
      let lineHeightPx = parseFloat(computed.lineHeight);
      if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) {
        const fontSize = parseFloat(computed.fontSize) || 16;
        lineHeightPx = fontSize * 1.2;
      }

      const mainRect = main.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const offsetTop = bodyRect.top - mainRect.top;
      const availableHeight = mainRect.height - offsetTop;
      const pageHeight = Math.min(lineHeightPx * MAX_LINES_PER_PAGE, availableHeight);

      if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
        setPages(['']);
        return;
      }

      body.innerHTML = '';

      const measureHost = document.createElement('div');
      measureHost.className = 'markdown-measure-host';
      body.appendChild(measureHost);

      const rootRenderer = createRoot(measureHost);
      rootRenderer.render(
        <div className="markdown-measure-wrapper">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
            {content || ''}
          </ReactMarkdown>
        </div>
      );

      await nextFrame();
      await nextFrame();

      if (cancelled) {
        rootRenderer.unmount();
        return;
      }

      const wrapper = measureHost.querySelector('.markdown-measure-wrapper');
      const sourceNodes = wrapper ? Array.from(wrapper.childNodes) : [];
      const pagesHtml = paginateNodes(sourceNodes, body, { pageHeight, lineHeight: lineHeightPx });

      rootRenderer.unmount();
      if (measureHost.parentNode === body) {
        body.removeChild(measureHost);
      }
      body.innerHTML = '';

      if (!cancelled) {
        setPages(pagesHtml);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [content, heading, title, docDate, hideHeader, preTitleCaptions, suppressTitlePlaceholder]);

  // Notify parent of page count for global numbering if requested
  useEffect(() => {
    try {
      if (typeof onPageCount === 'function') {
        onPageCount(Array.isArray(pages) ? pages.length : 0);
      }
    } catch (_) {}
  }, [onPageCount, pages.length]);

  // Render hidden measurer and visible pages
  return (
    <>
      <div ref={measurerRef} className="page-measurer" aria-hidden style={{ position: 'absolute', inset: '-10000px auto auto -10000px' }}>
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
          {/* Empty body for measuring sizes */}
        </PleadingPage>
      </div>
      {pages.map((html, pageIndex) => (
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
              hideHeaderBlocks={hideHeader}
            preTitleCaptions={preTitleCaptions}
            pageNumber={pageOffset + pageIndex + 1}
            totalPages={typeof totalOverride === 'number' ? totalOverride : (pageOffset + pages.length)}
            docDate={docDate}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={disableSignature ? false : (pageIndex === pages.length - 1)}
          >
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
