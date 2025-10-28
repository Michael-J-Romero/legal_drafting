'use client';

import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

const TOLERANCE_PX = 0.5;

const styleStringToObject = (styleString = '') => {
  if (!styleString) return undefined;
  const result = {};
  styleString.split(';').forEach((chunk) => {
    const [prop, value] = chunk.split(':');
    if (!prop || typeof value === 'undefined') return;
    const camel = prop
      .trim()
      .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/^-+/, '');
    if (!camel) return;
    result[camel] = value.trim();
  });
  return result;
};

const domNodeToReact = (node, keyPrefix = 'node') => {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const tag = node.tagName.toLowerCase();
  const props = { key: keyPrefix };
  Array.from(node.attributes).forEach((attr) => {
    if (attr.name === 'class') {
      props.className = attr.value;
    } else if (attr.name === 'style') {
      const parsed = styleStringToObject(attr.value);
      if (parsed) props.style = parsed;
    } else {
      props[attr.name] = attr.value;
    }
  });
  const children = Array.from(node.childNodes)
    .map((child, index) => domNodeToReact(child, `${keyPrefix}-${index}`))
    .filter((child) => child !== null && child !== undefined);
  return React.createElement(tag, props, children.length === 0 ? null : children);
};

const collectTextNodes = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let total = 0;
  while (walker.nextNode()) {
    const current = walker.currentNode;
    const length = current.nodeValue.length;
    nodes.push({ node: current, length });
    total += length;
  }
  return { nodes, total };
};

const locateCharPosition = (nodes, charIndex) => {
  if (!nodes.length) return null;
  if (charIndex <= 0) {
    return { node: nodes[0].node, offset: 0 };
  }
  let remaining = charIndex;
  for (let i = 0; i < nodes.length; i += 1) {
    const { node, length } = nodes[i];
    if (remaining <= length) {
      return { node, offset: remaining };
    }
    remaining -= length;
  }
  const last = nodes[nodes.length - 1];
  return { node: last.node, offset: last.length };
};

const pruneNodeAfter = (root, charIndex) => {
  const { nodes, total } = collectTextNodes(root);
  if (!nodes.length || charIndex >= total) return;
  const location = locateCharPosition(nodes, charIndex);
  if (!location) return;
  const range = document.createRange();
  range.setStart(location.node, location.offset);
  range.setEndAfter(root);
  range.deleteContents();
};

const pruneNodeBefore = (root, charIndex) => {
  const { nodes } = collectTextNodes(root);
  if (!nodes.length || charIndex <= 0) return;
  const location = locateCharPosition(nodes, charIndex);
  if (!location) return;
  const range = document.createRange();
  range.setStartBefore(root);
  range.setEnd(location.node, location.offset);
  range.deleteContents();
};

const cleanupEmptyNodes = (root) => {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  const toRemove = [];
  while (walker.nextNode()) {
    const current = walker.currentNode;
    if (current.childNodes.length === 0 && current.textContent.trim().length === 0) {
      toRemove.push(current);
    }
  }
  toRemove.forEach((node) => {
    if (node.parentNode) node.parentNode.removeChild(node);
  });
};

const splitElementByHeight = (element, limitBottom, contextBody) => {
  const probe = element.cloneNode(true);
  contextBody.appendChild(probe);
  const { nodes, total } = collectTextNodes(probe);
  if (!nodes.length) {
    contextBody.removeChild(probe);
    return [null, element];
  }
  const range = document.createRange();
  range.setStart(nodes[0].node, 0);
  let low = 1;
  let high = total - 1;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const location = locateCharPosition(nodes, mid);
    if (!location) break;
    range.setEnd(location.node, location.offset);
    const rects = range.getClientRects();
    const bottom = rects.length ? rects[rects.length - 1].bottom : range.getBoundingClientRect().bottom;
    if (bottom <= limitBottom + TOLERANCE_PX) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  contextBody.removeChild(probe);
  if (best <= 0 || best >= total) {
    return [null, element];
  }
  let head = null;
  let tail = null;
  let cursor = best;
  while (cursor > 0 && !head) {
    const headCandidate = element.cloneNode(true);
    const tailCandidate = element.cloneNode(true);
    pruneNodeAfter(headCandidate, cursor);
    pruneNodeBefore(tailCandidate, cursor);
    cleanupEmptyNodes(headCandidate);
    cleanupEmptyNodes(tailCandidate);
    const headHasText = headCandidate.textContent.trim().length > 0 || (headCandidate.nodeType === Node.ELEMENT_NODE && headCandidate.querySelector('*'));
    if (!headHasText) {
      cursor -= 1;
      continue;
    }
    contextBody.appendChild(headCandidate);
    const fits = contextBody.getBoundingClientRect().bottom <= limitBottom + TOLERANCE_PX;
    contextBody.removeChild(headCandidate);
    if (fits) {
      head = headCandidate;
      tail = tailCandidate;
      break;
    }
    cursor -= 1;
  }
  if (!head) {
    return [null, element];
  }
  const hasDescendants = (node) => node && node.nodeType === Node.ELEMENT_NODE && node.querySelector('*');
  const tailHasContent = tail && (tail.textContent.trim().length > 0 || hasDescendants(tail));
  return [head, tailHasContent ? tail : null];
};

const createPageContext = (pageElement) => {
  if (!pageElement) return null;
  const body = pageElement.querySelector('.pleading-body');
  const lineColumn = pageElement.querySelector('.pleading-line-column');
  if (!body || !lineColumn) return null;
  return {
    body,
    lineColumn,
  };
};

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate, pageOffset = 0, totalOverride = null, hideHeader = false, preTitleCaptions = [], suppressTitlePlaceholder = false, onPageCount, disableSignature = false }) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    if (!measurerRef.current) return undefined;

    const root = measurerRef.current;
    const sourcePage = root.querySelector('[data-measure="source"]');
    const firstMeasurePage = root.querySelector('[data-measure="first"]');
    const standardMeasurePage = root.querySelector('[data-measure="standard"]');
    if (!sourcePage || !firstMeasurePage || !standardMeasurePage) return undefined;

    const sourceBody = sourcePage.querySelector('.pleading-body');
    const firstContext = createPageContext(firstMeasurePage);
    const standardContext = createPageContext(standardMeasurePage);
    if (!sourceBody || !firstContext || !standardContext) return undefined;

    const paginate = () => {
      const firstBody = firstContext.body;
      const standardBody = standardContext.body;
      if (!firstBody || !standardBody) return;

      const getLimitBottom = (ctx) => {
        const spans = ctx.lineColumn.querySelectorAll('span');
        if (!spans.length) return Number.POSITIVE_INFINITY;
        const last = spans[spans.length - 1].getBoundingClientRect();
        return last.bottom;
      };

      const firstLimit = getLimitBottom(firstContext);
      const standardLimit = getLimitBottom(standardContext);

      firstBody.innerHTML = '';
      standardBody.innerHTML = '';

      const sourceChildren = Array.from(sourceBody.childNodes).filter((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent.trim().length > 0;
        }
        return true;
      });

      const outputPages = [];
      let currentContext = { body: firstBody, limitBottom: firstLimit };

      const finalizePage = () => {
        const pageNodes = Array.from(currentContext.body.childNodes).map((child, idx) => domNodeToReact(child.cloneNode(true), `page-${outputPages.length}-${idx}`));
        outputPages.push(pageNodes);
        currentContext.body.innerHTML = '';
        currentContext = { body: standardBody, limitBottom: standardLimit };
      };

      const appendNode = (node) => {
        const target = currentContext.body;
        target.appendChild(node);
        const fits = target.getBoundingClientRect().bottom <= currentContext.limitBottom + TOLERANCE_PX;
        if (fits) {
          return true;
        }
        target.removeChild(node);
        return false;
      };

      const processBlock = (originalNode) => {
        if (!originalNode) return;
        const attempt = originalNode.cloneNode(true);
        if (appendNode(attempt)) {
          return;
        }

        const target = currentContext.body;
        const isEmptyPage = target.childNodes.length === 0;
        if (!isEmptyPage) {
          finalizePage();
          processBlock(originalNode);
          return;
        }

        const [head, tail] = splitElementByHeight(originalNode.cloneNode(true), currentContext.limitBottom, target);
        if (!head) {
          target.appendChild(originalNode.cloneNode(true));
          finalizePage();
          return;
        }
        if (!appendNode(head)) {
          target.appendChild(originalNode.cloneNode(true));
          finalizePage();
          return;
        }
        finalizePage();
        if (tail) {
          processBlock(tail);
        }
      };

      sourceChildren.forEach((child) => {
        processBlock(child);
      });

      if (currentContext.body.childNodes.length > 0 || outputPages.length === 0) {
        const pageNodes = Array.from(currentContext.body.childNodes).map((child, idx) => domNodeToReact(child.cloneNode(true), `page-${outputPages.length}-${idx}`));
        outputPages.push(pageNodes);
        currentContext.body.innerHTML = '';
      }
      setPages(outputPages);
    };

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(paginate);
    });

    resizeObserver.observe(sourceBody);
    window.addEventListener('resize', paginate);

    window.requestAnimationFrame(paginate);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', paginate);
    };
  }, [content, heading, hideHeader, preTitleCaptions, suppressTitlePlaceholder, title, docDate]);

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
        <div data-measure="first">
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
          />
        </div>
        <div data-measure="standard">
          <PleadingPage
            heading={heading}
            title={title}
            firstPage={false}
            pageNumber={1}
            totalPages={1}
            docDate={docDate}
            hideHeaderBlocks={hideHeader}
            preTitleCaptions={[]}
            suppressTitlePlaceholder
            showSignature={false}
          />
        </div>
        <div data-measure="source">
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
              {content || ''}
            </ReactMarkdown>
          </PleadingPage>
        </div>
      </div>
      {pages.map((nodes, pageIndex) => (
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
            {nodes && nodes.length > 0 ? nodes : null}
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
