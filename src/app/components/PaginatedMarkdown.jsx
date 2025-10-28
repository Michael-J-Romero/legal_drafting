'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate, pageOffset = 0, totalOverride = null, hideHeader = false, preTitleCaptions = [], suppressTitlePlaceholder = false, onPageCount, disableSignature = false }) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState([]);

  const markdownComponents = useMemo(() => ({
    table: (props) => <table className="md-table" {...props} />,
    th: (props) => <th className="md-table-cell" {...props} />,
    td: (props) => <td className="md-table-cell" {...props} />,
  }), []);

  useEffect(() => {
    if (!measurerRef.current) return undefined;

    const root = measurerRef.current;
    const main = root.querySelector('.pleading-main');
    const body = root.querySelector('.pleading-body');
    if (!main || !body) return undefined;

    const scratch = document.createElement('div');
    scratch.className = body.className;
    scratch.style.visibility = 'hidden';
    scratch.style.position = 'absolute';
    scratch.style.pointerEvents = 'none';
    scratch.style.left = '0';
    scratch.style.right = '0';
    scratch.style.top = '0';
    scratch.style.zIndex = '-1';
    body.appendChild(scratch);

    const getLineHeight = () => {
      const cs = window.getComputedStyle(body);
      const lh = parseFloat(cs.lineHeight);
      if (!Number.isFinite(lh) || lh <= 0) {
        return 18; // fallback to ~12pt line height if unable to compute
      }
      return lh;
    };

    const cleanupEmpty = (node) => {
      const elementWalker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (candidate) => {
          if (candidate.childNodes.length === 0 && candidate.textContent === '') return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        },
      });
      const emptyElements = [];
      while (elementWalker.nextNode()) {
        emptyElements.push(elementWalker.currentNode);
      }
      emptyElements.forEach((n) => {
        if (n.parentNode) n.parentNode.removeChild(n);
      });

      const textWalker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const emptyTexts = [];
      while (textWalker.nextNode()) {
        if (!textWalker.currentNode.textContent || !textWalker.currentNode.textContent.trim()) {
          emptyTexts.push(textWalker.currentNode);
        }
      }
      emptyTexts.forEach((textNode) => {
        if (textNode.parentNode) {
          textNode.parentNode.removeChild(textNode);
        }
      });
    };

    const trimCloneToCount = (clone, keepChars, keepFromStart = true) => {
      const textWalker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
      let remaining = keepChars;
      const nodes = [];
      while (textWalker.nextNode()) {
        nodes.push(textWalker.currentNode);
      }
      if (keepFromStart) {
        let consumed = 0;
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i];
          const len = node.textContent.length;
          if (consumed + len <= remaining) {
            consumed += len;
          } else {
            const take = Math.max(0, remaining - consumed);
            node.textContent = node.textContent.slice(0, take);
            consumed = remaining;
            for (let j = i + 1; j < nodes.length; j += 1) {
              const drop = nodes[j];
              if (drop.parentNode) drop.parentNode.removeChild(drop);
            }
            break;
          }
        }
      } else {
        let consumed = 0;
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i];
          const len = node.textContent.length;
          if (consumed + len <= remaining) {
            node.textContent = '';
            consumed += len;
          } else {
            const start = Math.max(0, remaining - consumed);
            node.textContent = node.textContent.slice(start);
            consumed = remaining;
            break;
          }
        }
      }
      cleanupEmpty(clone);
    };

    const splitElementByHeight = (html, availableHeight) => {
      const container = document.createElement('div');
      container.innerHTML = html;
      const element = container.firstElementChild;
      if (!element) return null;

      const totalTextLength = (() => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let length = 0;
        while (walker.nextNode()) {
          length += walker.currentNode.textContent.length;
        }
        return length;
      })();
      if (totalTextLength === 0) return null;

      let low = 1;
      let high = totalTextLength;
      let best = 0;
      const tolerance = 0.25;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const testClone = element.cloneNode(true);
        trimCloneToCount(testClone, mid, true);
        scratch.innerHTML = '';
        scratch.appendChild(testClone);
        const height = scratch.getBoundingClientRect().height;
        if (height <= availableHeight + tolerance) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (best === 0) return null;

      const fitClone = element.cloneNode(true);
      trimCloneToCount(fitClone, best, true);
      const remainingClone = element.cloneNode(true);
      trimCloneToCount(remainingClone, best, false);

      scratch.innerHTML = '';
      scratch.appendChild(fitClone);
      const fitHeight = scratch.getBoundingClientRect().height;

      let leftoverPayload = null;
      if (remainingClone.outerHTML.trim()) {
        scratch.innerHTML = '';
        scratch.appendChild(remainingClone);
        const leftoverHeight = scratch.getBoundingClientRect().height;
        leftoverPayload = {
          html: remainingClone.outerHTML,
          height: leftoverHeight,
        };
      }

      return {
        fit: { html: fitClone.outerHTML, height: fitHeight },
        leftover: leftoverPayload,
      };
    };

    const computePages = () => {
      const lineHeight = getLineHeight();
      const maxBodyHeight = lineHeight * 28;
      const mainRect = main.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const bodyTop = bodyRect.top - mainRect.top;
      const firstPageHeight = Math.min(maxBodyHeight, Math.max(0, mainRect.height - bodyTop));
      const regularPageHeight = Math.min(maxBodyHeight, mainRect.height);

      const items = [];
      Array.from(body.childNodes).forEach((node) => {
        if (node === scratch) return;
        if (node.nodeType === Node.TEXT_NODE) {
          if (!node.textContent.trim()) return;
          const wrapper = document.createElement('p');
          wrapper.textContent = node.textContent.trim();
          scratch.innerHTML = '';
          scratch.appendChild(wrapper);
          const height = scratch.getBoundingClientRect().height;
          items.push({
            html: wrapper.outerHTML,
            height,
            canSplit: true,
          });
          return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node;
          items.push({
            html: element.outerHTML,
            height: element.getBoundingClientRect().height,
            canSplit: element.matches('p, li, ul, ol, blockquote'),
          });
        }
      });
      const outputPages = [];
      let current = [];
      let remaining = firstPageHeight;

      const pushPage = () => {
        if (current.length) {
          outputPages.push(current.join(''));
        } else if (!outputPages.length) {
          outputPages.push('');
        }
        current = [];
        remaining = regularPageHeight;
      };

      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];

        if (item.height <= remaining + 0.01) {
          current.push(item.html);
          remaining = Math.max(0, remaining - item.height);
          continue;
        }

        if (remaining <= lineHeight * 0.75) {
          pushPage();
          i -= 1;
          continue;
        }

        if (item.canSplit || item.height > regularPageHeight) {
          const result = splitElementByHeight(item.html, remaining);
          if (!result) {
            pushPage();
            i -= 1;
            continue;
          }
          current.push(result.fit.html);
          remaining = Math.max(0, remaining - result.fit.height);
          if (result.leftover) {
            items.splice(i + 1, 0, {
              html: result.leftover.html,
              height: result.leftover.height,
              canSplit: item.canSplit,
            });
            pushPage();
          }
          continue;
        }

        pushPage();
        i -= 1;
      }

      if (current.length) {
        outputPages.push(current.join(''));
      }

      setPages(outputPages.length ? outputPages : ['']);
    };

    const observer = new ResizeObserver(() => {
      computePages();
    });
    observer.observe(body);

    computePages();

    return () => {
      observer.disconnect();
      if (scratch.parentNode) scratch.parentNode.removeChild(scratch);
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
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content || ''}
          </ReactMarkdown>
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
