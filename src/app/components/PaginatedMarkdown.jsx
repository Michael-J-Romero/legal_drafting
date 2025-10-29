'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

// Utility guard for whitespace-only text nodes
const isEmptyText = (node) => node?.nodeType === TEXT_NODE && !(node.textContent || '').trim();

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate, pageOffset = 0, totalOverride = null, hideHeader = false, preTitleCaptions = [], suppressTitlePlaceholder = false, onPageCount, disableSignature = false }) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState([]);

  const markdown = useMemo(() => content || '', [content]);

  const computePages = useCallback(() => {
    if (!measurerRef.current) return;
    const root = measurerRef.current;
    const body = root.querySelector('.pleading-body');
    if (!body) return;

    const computed = window.getComputedStyle(body);
    const lineHeight = parseFloat(computed.lineHeight || '0');
    if (!lineHeight) return;

    const pageHeight = lineHeight * 28;
    const tolerance = lineHeight * 0.2;

    const scratch = body.cloneNode(false);
    scratch.style.position = 'absolute';
    scratch.style.visibility = 'hidden';
    scratch.style.pointerEvents = 'none';
    scratch.style.top = '-10000px';
    scratch.style.left = '-10000px';
    scratch.style.width = `${body.getBoundingClientRect().width}px`;
    root.appendChild(scratch);

    const sourceNodes = Array.from(body.childNodes)
      .filter((node) => !isEmptyText(node))
      .map((node) => node.cloneNode(true));

    if (!sourceNodes.length) {
      scratch.remove();
      setPages(['']);
      return;
    }

    const results = [];
    const queue = [...sourceNodes];

    const fitNodeInto = (node, parent) => {
      if (!node) return null;

      if (node.nodeType === TEXT_NODE) {
        const text = node.textContent || '';
        if (!text) {
          parent.appendChild(document.createTextNode(''));
          return null;
        }

        const holder = document.createTextNode('');
        parent.appendChild(holder);

        let low = 0;
        let high = text.length;
        let best = 0;
        while (low <= high) {
          const mid = Math.ceil((low + high) / 2);
          holder.textContent = text.slice(0, mid);
          if (scratch.scrollHeight <= pageHeight + tolerance) {
            best = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        if (best === 0) {
          parent.removeChild(holder);
          return node.cloneNode(true);
        }

        holder.textContent = text.slice(0, best);
        const remainderText = text.slice(best);
        return remainderText ? document.createTextNode(remainderText) : null;
      }

      if (node.nodeType === ELEMENT_NODE) {
        const clone = node.cloneNode(false);
        parent.appendChild(clone);

        if (scratch.scrollHeight > pageHeight + tolerance) {
          parent.removeChild(clone);
          return node.cloneNode(true);
        }

        const children = Array.from(node.childNodes);
        let appendedItems = 0;

        for (let i = 0; i < children.length; i += 1) {
          const child = children[i];
          const remainder = fitNodeInto(child, clone);
          if (!remainder && child.nodeName === 'LI') {
            appendedItems += 1;
          }
          if (remainder) {
            if (!clone.hasChildNodes()) {
              parent.removeChild(clone);
            }

            const tail = node.cloneNode(false);
            if (node.nodeName === 'P' || node.nodeName === 'LI') {
              tail.setAttribute('data-continued', 'true');
            }

            if (node.nodeName === 'OL') {
              const startAttr = node.getAttribute('start');
              const startIndex = startAttr ? parseInt(startAttr, 10) || 1 : 1;
              tail.setAttribute('start', String(startIndex + appendedItems));
            }

            tail.appendChild(remainder);
            for (let j = i + 1; j < children.length; j += 1) {
              tail.appendChild(children[j].cloneNode(true));
            }
            return tail;
          }
        }

        if (scratch.scrollHeight > pageHeight + tolerance) {
          if (clone.parentNode === parent) {
            parent.removeChild(clone);
          }
          return node.cloneNode(true);
        }

        return null;
      }

      const fallback = node.cloneNode(true);
      parent.appendChild(fallback);
      if (scratch.scrollHeight > pageHeight + tolerance) {
        parent.removeChild(fallback);
        return node.cloneNode(true);
      }
      return null;
    };

    while (queue.length) {
      scratch.innerHTML = '';
      let appended = false;

      while (queue.length) {
        const current = queue.shift();
        const beforeCount = scratch.childNodes.length;
        const remainder = fitNodeInto(current, scratch);
        const afterCount = scratch.childNodes.length;
        appended = appended || afterCount > beforeCount;
        if (remainder) {
          queue.unshift(remainder);
          break;
        }
      }

      if (!appended) {
        // No progress could be made; avoid infinite loop
        break;
      }

      results.push(scratch.innerHTML);
    }

    scratch.remove();
    setPages(results.length ? results : ['']);
  }, [markdown, heading, title, hideHeader, preTitleCaptions, suppressTitlePlaceholder]);

  useEffect(() => {
    if (!measurerRef.current) return;
    const root = measurerRef.current;
    const body = root.querySelector('.pleading-body');
    if (!body) return;

    let raf = requestAnimationFrame(() => computePages());
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => computePages());
    });
    observer.observe(body);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [computePages]);

  // Notify parent of page count for global numbering if requested
  useEffect(() => {
    try {
      if (typeof onPageCount === 'function') {
        onPageCount(Array.isArray(pages) ? pages.length : 0);
      }
    } catch (_) {}
  }, [onPageCount, pages.length]);

  const renderedPages = pages.length ? pages : [''];

  return (
    <>
      <div
        ref={measurerRef}
        className="page-measurer"
        aria-hidden
        style={{ position: 'absolute', inset: '-10000px auto auto -10000px' }}
      >
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
            {markdown}
          </ReactMarkdown>
        </PleadingPage>
      </div>

      {renderedPages.map((html, pageIndex) => (
        <div className="page-wrapper" key={`md-page-${pageIndex}`}>
          <button
            type="button"
            className="fullscreen-toggle"
            title="Fullscreen"
            onClick={() => {
              /* fullscreen handled by outer preview using fragment id */
            }}
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
            totalPages={typeof totalOverride === 'number' ? totalOverride : (pageOffset + renderedPages.length)}
            docDate={docDate}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={disableSignature ? false : pageIndex === renderedPages.length - 1}
          >
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
