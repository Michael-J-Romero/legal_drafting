'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

// Helper used inside pagination logic to filter out zero-sized rects
const rectIsVisible = (rect) => rect && rect.height > 0.5 && rect.width > 0.5;

export default function PaginatedMarkdown({
  content,
  heading,
  title,
  docDate,
  pageOffset = 0,
  totalOverride = null,
  hideHeader = false,
  preTitleCaptions = [],
  suppressTitlePlaceholder = false,
  onPageCount,
  disableSignature = false,
}) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState([]);

  const markdownComponents = useMemo(
    () => ({
      table: (props) => <table className="md-table" {...props} />,
      th: (props) => <th className="md-table-cell" {...props} />,
      td: (props) => <td className="md-table-cell" {...props} />,
    }),
    [],
  );

  const recomputePages = useCallback(() => {
    if (!measurerRef.current) return;

    const root = measurerRef.current;
    const main = root.querySelector('.pleading-main');
    const body = root.querySelector('.pleading-body');
    if (!main || !body) return;

    const computedStyle = window.getComputedStyle(body);
    const lineHeight = parseFloat(computedStyle.lineHeight || '0');
    if (!lineHeight) return;

    const linesPerPage = 28;
    const mainRect = main.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const firstPageLines = Math.max(
      1,
      Math.min(linesPerPage, Math.floor((mainRect.bottom - bodyRect.top) / lineHeight)),
    );
    const defaultPageLines = linesPerPage;

    const blocks = Array.from(body.children).filter((node) => node.nodeType === Node.ELEMENT_NODE);

    const withTemporaryAttachment = (node, callback) => {
      if (!(node instanceof Element)) return callback(node);
      if (node.isConnected) {
        return callback(node);
      }
      const originalStyle = node.getAttribute('style');
      node.style.position = 'absolute';
      node.style.visibility = 'hidden';
      node.style.pointerEvents = 'none';
      node.style.left = '-20000px';
      body.appendChild(node);
      try {
        return callback(node);
      } finally {
        if (node.parentNode) node.parentNode.removeChild(node);
        if (originalStyle !== null) {
          node.setAttribute('style', originalStyle);
        } else {
          node.removeAttribute('style');
        }
      }
    };

    const countLines = (node) => withTemporaryAttachment(node, (target) => {
      const range = document.createRange();
      range.selectNodeContents(target);
      const rects = Array.from(range.getClientRects()).filter(rectIsVisible);
      if (rects.length) return rects.length;
      const bounds = target.getBoundingClientRect();
      if (bounds.height > 0) {
        return Math.max(1, Math.round(bounds.height / lineHeight));
      }
      return 0;
    });

    const splitNodeByLines = (node, limit) => {
      if (limit <= 0) {
        return {
          head: null,
          remainder: node.cloneNode(true),
          headLines: 0,
          totalLines: countLines(node),
        };
      }

      return withTemporaryAttachment(node, (target) => {
        const totalRange = document.createRange();
        totalRange.selectNodeContents(target);
        const totalRects = Array.from(totalRange.getClientRects()).filter(rectIsVisible);
        const totalLines = totalRects.length || Math.max(1, Math.round(target.getBoundingClientRect().height / lineHeight));

        if (totalLines <= limit) {
          return { head: target.cloneNode(true), remainder: null, headLines: totalLines, totalLines };
        }

        const walker = document.createTreeWalker(
          target,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(textNode) {
              return textNode.textContent.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            },
          },
        );

        let current = walker.nextNode();
        if (!current) {
          return { head: target.cloneNode(true), remainder: null, headLines: totalLines, totalLines };
        }

        const workingRange = document.createRange();
        workingRange.setStart(current, 0);
        let lastGood = null;
        let exhausted = false;

        const usedLines = () => Array.from(workingRange.getClientRects()).filter(rectIsVisible).length;

        while (!exhausted && current) {
          const length = current.textContent.length;
          for (let offset = 1; offset <= length; offset += 1) {
            workingRange.setEnd(current, offset);
            const lineCount = usedLines();
            if (lineCount <= limit) {
              lastGood = workingRange.cloneRange();
            } else {
              if (!lastGood) {
                workingRange.setEnd(current, offset);
                lastGood = workingRange.cloneRange();
              }
              exhausted = true;
              break;
            }
          }
          if (exhausted) break;
          const next = walker.nextNode();
          if (!next) {
            lastGood = workingRange.cloneRange();
            break;
          }
          current = next;
        }

        const finalRange = lastGood || workingRange;
        let headLines = Array.from(finalRange.getClientRects()).filter(rectIsVisible).length;
        if (!headLines) {
          headLines = Math.min(limit, totalLines);
        }

        const headFragment = finalRange.cloneContents();
        const headClone = target.cloneNode(false);
        headClone.appendChild(headFragment);

        const remainderRange = document.createRange();
        remainderRange.setStart(finalRange.endContainer, finalRange.endOffset);
        remainderRange.setEndAfter(target.lastChild);
        const remainderFragment = remainderRange.cloneContents();

        let remainderClone = null;
        if (
          remainderFragment &&
          (remainderFragment.textContent.trim().length || remainderFragment.childNodes.length > 0)
        ) {
          remainderClone = target.cloneNode(false);
          remainderClone.appendChild(remainderFragment);
        }

        return {
          head: headClone,
          remainder: remainderClone,
          headLines,
          totalLines,
        };
      });
    };

    const pagesHtml = [];
    const queue = [...blocks];
    let currentNodes = [];
    let remainingLines = firstPageLines;

    const pushCurrentPage = (force = false) => {
      if (currentNodes.length || (!pagesHtml.length && force)) {
        const wrapper = document.createElement('div');
        currentNodes.forEach((node) => {
          wrapper.appendChild(node);
        });
        pagesHtml.push(wrapper.innerHTML);
      } else if (!pagesHtml.length) {
        pagesHtml.push('');
      }
      currentNodes = [];
      remainingLines = defaultPageLines;
      // After the first push every page has the standard line allotment
    };

    while (queue.length) {
      const node = queue.shift();
      if (!node) continue;

      const totalLines = countLines(node);
      if (totalLines === 0) continue;

      if (totalLines <= remainingLines) {
        currentNodes.push(node.cloneNode(true));
        remainingLines -= totalLines;
        if (remainingLines === 0) {
          pushCurrentPage();
        }
        continue;
      }

      if (remainingLines === 0) {
        pushCurrentPage();
        queue.unshift(node);
        continue;
      }

      const { head, remainder, headLines } = splitNodeByLines(node, remainingLines);
      if (head && headLines > 0) {
        currentNodes.push(head);
        remainingLines -= headLines;
      }

      if (remainingLines === 0) {
        pushCurrentPage();
      }

      if (remainder) {
        queue.unshift(remainder);
      } else if (!head) {
        // Fallback to avoid infinite loops for unsplittable nodes
        pushCurrentPage(currentNodes.length === 0);
        queue.unshift(node.cloneNode(true));
      }
    }

    if (currentNodes.length || !pagesHtml.length) {
      const wrapper = document.createElement('div');
      currentNodes.forEach((node) => {
        wrapper.appendChild(node);
      });
      pagesHtml.push(wrapper.innerHTML);
    }

    setPages(pagesHtml);
  }, [
    content,
    heading,
    title,
    docDate,
    hideHeader,
    preTitleCaptions,
    suppressTitlePlaceholder,
  ]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      recomputePages();
    });
    return () => cancelAnimationFrame(raf);
  }, [recomputePages]);

  useEffect(() => {
    if (!measurerRef.current) return undefined;
    const body = measurerRef.current.querySelector('.pleading-body');
    if (!body) return undefined;

    const observer = new ResizeObserver(() => {
      recomputePages();
    });
    observer.observe(body);

    return () => observer.disconnect();
  }, [recomputePages]);

  useEffect(() => {
    try {
      if (typeof onPageCount === 'function') {
        onPageCount(Array.isArray(pages) ? pages.length : 0);
      }
    } catch (err) {
      console.error(err);
    }
  }, [onPageCount, pages.length]);

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
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content}
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
            totalPages={typeof totalOverride === 'number' ? totalOverride : pageOffset + pages.length}
            docDate={docDate}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={disableSignature ? false : pageIndex === pages.length - 1}
          >
            <div
              className="markdown-fragment"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
