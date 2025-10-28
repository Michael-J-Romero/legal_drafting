'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate }) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState(['']);

  const renderMarkdown = useMemo(
    () => (
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
    ),
    [content],
  );

  useLayoutEffect(() => {
    if (!measurerRef.current) return undefined;

    const root = measurerRef.current;
    const firstPageMain = root.querySelector('[data-page="first"] .pleading-main');
    const firstPageBody = root.querySelector('[data-page="first"] .pleading-body');
    const otherPageMain = root.querySelector('[data-page="other"] .pleading-main');
    const otherPageBody = root.querySelector('[data-page="other"] .pleading-body');

    if (!firstPageMain || !firstPageBody || !otherPageMain || !otherPageBody) return undefined;

    const computePages = () => {
      const style = window.getComputedStyle(firstPageBody);
      const lineHeight = parseFloat(style.lineHeight || '0');
      if (!lineHeight) {
        setPages((prev) => (prev.length ? prev : ['']));
        return;
      }

      const totalLines = 28;
      const lineHeightTotal = lineHeight * totalLines;

      const firstMainRect = firstPageMain.getBoundingClientRect();
      const firstBodyRect = firstPageBody.getBoundingClientRect();
      const otherMainRect = otherPageMain.getBoundingClientRect();
      const otherBodyRect = otherPageBody.getBoundingClientRect();

      const firstOffset = firstBodyRect.top - firstMainRect.top;
      const otherOffset = otherBodyRect.top - otherMainRect.top;

      const firstPageLimit = Math.max(0, lineHeightTotal - firstOffset);
      const otherPageLimit = Math.max(0, lineHeightTotal - otherOffset);

      const scratch = firstPageBody.cloneNode(false);
      scratch.style.position = 'absolute';
      scratch.style.visibility = 'hidden';
      scratch.style.pointerEvents = 'none';
      scratch.style.left = '-10000px';
      scratch.style.top = '0';
      scratch.style.width = `${firstBodyRect.width}px`;
      scratch.style.height = 'auto';
      scratch.style.maxHeight = 'none';
      root.appendChild(scratch);

      const measureHeight = (node) => {
        scratch.replaceChildren(node);
        const rect = scratch.getBoundingClientRect();
        scratch.replaceChildren();
        return rect.height;
      };

      const getTextLength = (node) => {
        if (!node) return 0;
        if (node.nodeType === Node.TEXT_NODE) {
          return (node.textContent || '').length;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const text = node.textContent || '';
          return text.length || 1;
        }
        return 0;
      };

      const cloneUpTo = (node, count) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return document.createTextNode((node.textContent || '').slice(0, count));
        }
        const clone = node.cloneNode(false);
        let remaining = count;
        const children = Array.from(node.childNodes);
        for (let i = 0; i < children.length; i += 1) {
          if (remaining <= 0) break;
          const child = children[i];
          const childTextLength = getTextLength(child);
          if (childTextLength <= remaining) {
            clone.appendChild(child.cloneNode(true));
            remaining -= childTextLength;
          } else if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent || '';
            clone.appendChild(document.createTextNode(text.slice(0, remaining)));
            remaining = 0;
          } else {
            const partial = cloneUpTo(child, remaining);
            clone.appendChild(partial);
            remaining = 0;
          }
        }
        return clone;
      };

      const cloneFromOffset = (node, offset) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          const start = Math.min(offset, text.length);
          return document.createTextNode(text.slice(start));
        }
        const clone = node.cloneNode(false);
        let remaining = offset;
        const children = Array.from(node.childNodes);
        for (let i = 0; i < children.length; i += 1) {
          const child = children[i];
          const childTextLength = getTextLength(child);
          if (remaining > 0) {
            if (remaining >= childTextLength) {
              remaining -= childTextLength;
              continue;
            }
            if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent || '';
              clone.appendChild(document.createTextNode(text.slice(remaining)));
              remaining = 0;
            } else {
              const partial = cloneFromOffset(child, remaining);
              clone.appendChild(partial);
              remaining = 0;
            }
          } else {
            clone.appendChild(child.cloneNode(true));
          }
        }
        return clone;
      };

      const isSplittable = (element) => {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
        const tag = element.tagName;
        return ['P', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag);
      };

      const splitBlock = (element, maxHeight) => {
        const totalLength = getTextLength(element);
        if (totalLength === 0) {
          return { fit: null, remainder: element.cloneNode(true) };
        }

        let low = 1;
        let high = totalLength;
        let bestNode = null;
        let bestOffset = 0;

        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const candidate = cloneUpTo(element, mid);
          const height = measureHeight(candidate);
          if (height <= maxHeight) {
            bestNode = candidate;
            bestOffset = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        if (!bestNode || bestOffset === 0) {
          return { fit: null, remainder: element.cloneNode(true) };
        }

        const elementText = element.textContent || '';
        let adjustedOffset = bestOffset;
        let adjustedNode = bestNode;
        while (adjustedOffset > 0 && adjustedOffset > bestOffset - 200) {
          const char = elementText.charAt(adjustedOffset - 1);
          if (/\s/.test(char)) {
            const candidate = cloneUpTo(element, adjustedOffset);
            if (measureHeight(candidate) <= maxHeight) {
              adjustedNode = candidate;
              break;
            }
          }
          adjustedOffset -= 1;
        }

        if (adjustedNode !== bestNode) {
          bestNode = adjustedNode;
          bestOffset = adjustedOffset;
        }

        const remainder = bestOffset < totalLength ? cloneFromOffset(element, bestOffset) : null;
        return { fit: bestNode, remainder };
      };

      const initialBlocks = Array.from(firstPageBody.children);
      const queue = initialBlocks.map((node) => node.cloneNode(true));
      const originalQueue = initialBlocks.map((node) => node);

      const computedPages = [];
      let currentPageNodes = [];
      let remainingHeight = firstPageLimit;

      const pushPage = () => {
        computedPages.push(currentPageNodes);
        currentPageNodes = [];
        remainingHeight = otherPageLimit;
      };

      const tolerance = 0.5;

      while (queue.length > 0) {
        const blockClone = queue.shift();
        const original = originalQueue.shift();
        if (!blockClone || !original) {
          break;
        }

        const blockHeight = measureHeight(blockClone.cloneNode(true));

        if (blockHeight <= remainingHeight + tolerance) {
          currentPageNodes.push(blockClone);
          remainingHeight = Math.max(0, remainingHeight - blockHeight);
          continue;
        }

        if (remainingHeight <= tolerance) {
          if (currentPageNodes.length > 0) {
            pushPage();
            queue.unshift(blockClone);
            originalQueue.unshift(original);
            continue;
          }
          // No room but page empty: force block onto this page to avoid infinite loop
          currentPageNodes.push(blockClone);
          pushPage();
          continue;
        }

        if (isSplittable(original)) {
          const { fit, remainder } = splitBlock(original, remainingHeight);
          if (!fit) {
            if (currentPageNodes.length > 0) {
              pushPage();
              queue.unshift(blockClone);
              originalQueue.unshift(original);
            } else {
              currentPageNodes.push(blockClone);
              pushPage();
            }
            continue;
          }

          currentPageNodes.push(fit);
          const fitHeight = measureHeight(fit.cloneNode(true));
          remainingHeight = Math.max(0, remainingHeight - fitHeight);
          pushPage();
          if (remainder) {
            queue.unshift(remainder.cloneNode(true));
            originalQueue.unshift(remainder);
          }
        } else {
          if (currentPageNodes.length > 0) {
            pushPage();
            queue.unshift(blockClone);
            originalQueue.unshift(original);
          } else {
            currentPageNodes.push(blockClone);
            pushPage();
          }
        }
      }

      if (currentPageNodes.length > 0 || computedPages.length === 0) {
        computedPages.push(currentPageNodes);
      }

      const pageHtml = computedPages.map((nodes) => nodes.map((node) => node.outerHTML || '').join(''));
      const normalizedPages = pageHtml.length ? pageHtml : [''];
      setPages((prev) => {
        if (prev.length === normalizedPages.length && prev.every((value, index) => value === normalizedPages[index])) {
          return prev;
        }
        return normalizedPages;
      });

      scratch.remove();
    };

    computePages();

    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(() => {
        computePages();
      });

      resizeObserver.observe(firstPageMain);
      resizeObserver.observe(firstPageBody);
      resizeObserver.observe(otherPageMain);
      resizeObserver.observe(otherPageBody);

      return () => {
        resizeObserver.disconnect();
      };
    }

    return undefined;
  }, [content, heading, title]);

  const pageCount = pages.length || 1;

  return (
    <>
      <div ref={measurerRef} className="page-measurer" aria-hidden style={{ position: 'absolute', inset: '-10000px auto auto -10000px' }}>
        <div data-page="first">
          <PleadingPage heading={heading} title={title} firstPage pageNumber={1} totalPages={2} docDate={docDate}>
            {renderMarkdown}
          </PleadingPage>
        </div>
        <div data-page="other">
          <PleadingPage heading={heading} title={title} firstPage={false} pageNumber={2} totalPages={2} docDate={docDate}>
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
            onClick={() => { /* fullscreen handled by outer preview using fragment id */ }}
          >
            ⤢
          </button>
          <PleadingPage
            heading={heading}
            title={title}
            firstPage={pageIndex === 0}
            pageNumber={pageIndex + 1}
            totalPages={pageCount}
            docDate={docDate}
          >
            <div
              className="paginated-markdown-content"
              style={{ display: 'contents' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
