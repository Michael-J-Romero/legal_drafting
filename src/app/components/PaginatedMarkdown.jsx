'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

const HEIGHT_TOLERANCE_PX = 0.5;

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate }) {
  const measurerRef = useRef(null);
  const firstTemplateRef = useRef(null);
  const regularTemplateRef = useRef(null);
  const scratchRef = useRef(null);
  const testRef = useRef(null);
  const [pages, setPages] = useState([]);

  const markdown = useMemo(() => content || '', [content]);

  const markdownComponents = useMemo(
    () => ({
      table: (props) => <table className="md-table" {...props} />,
      th: (props) => <th className="md-table-cell" {...props} />,
      td: (props) => <td className="md-table-cell" {...props} />,
    }),
    [],
  );

  useEffect(() => {
    const measurer = measurerRef.current;
    const firstTemplate = firstTemplateRef.current;
    const regularTemplate = regularTemplateRef.current;
    const scratch = scratchRef.current;
    const testHost = testRef.current;

    if (!measurer || !firstTemplate || !regularTemplate || !scratch || !testHost) {
      return undefined;
    }

    const fallbackHTML = () => {
      const templateBody = firstTemplate.querySelector('.pleading-body');
      return templateBody ? templateBody.innerHTML : '';
    };

    const extractTextNode = (node, limit) => {
      if (!node || limit <= 0) return null;
      const textLength = node.textContent?.length || 0;
      if (textLength === 0) {
        node.remove();
        return null;
      }

      const range = document.createRange();
      let low = 1;
      let high = textLength;
      let best = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        range.setStart(node, 0);
        range.setEnd(node, mid);
        const rect = range.getBoundingClientRect();
        if (rect.height <= limit + HEIGHT_TOLERANCE_PX) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (best === 0) {
        return null;
      }

      if (best < textLength) {
        node.splitText(best);
      }

      const consumed = node.cloneNode(true);
      node.remove();
      return consumed;
    };

    const extractNodeByHeight = (node, limit) => {
      if (!node || limit <= 0) return null;

      if (node.nodeType === Node.TEXT_NODE) {
        return extractTextNode(node, limit);
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const fullRect = node.getBoundingClientRect();
        if (fullRect.height <= limit + HEIGHT_TOLERANCE_PX) {
          node.remove();
          return node;
        }

        const range = document.createRange();
        range.setStart(node, 0);
        let low = 0;
        let high = node.childNodes.length;
        let best = 0;

        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          range.setEnd(node, mid);
          const rect = range.getBoundingClientRect();
          if (rect.height <= limit + HEIGHT_TOLERANCE_PX) {
            best = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        if (best > 0) {
          range.setEnd(node, best);
          const contents = range.cloneContents();
          range.deleteContents();
          const wrapper = node.cloneNode(false);
          wrapper.appendChild(contents);
          if (!node.childNodes.length) {
            node.remove();
          }
          return wrapper;
        }

        const firstChild = node.firstChild;
        if (!firstChild) {
          node.remove();
          return node;
        }

        const partial = extractNodeByHeight(firstChild, limit);
        if (!partial) {
          return null;
        }
        const wrapper = node.cloneNode(false);
        wrapper.appendChild(partial);
        if (!node.childNodes.length) {
          node.remove();
        }
        return wrapper;
      }

      return null;
    };

    const extractFragmentForHeight = (container, limit) => {
      const fragment = document.createDocumentFragment();
      if (!container || limit <= 0) {
        return fragment;
      }

      const range = document.createRange();
      range.setStart(container, 0);
      const totalChildren = container.childNodes.length;
      let low = 0;
      let high = totalChildren;
      let best = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        range.setEnd(container, mid);
        const rect = range.getBoundingClientRect();
        if (rect.height <= limit + HEIGHT_TOLERANCE_PX) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (best > 0) {
        range.setEnd(container, best);
        const contents = range.cloneContents();
        range.deleteContents();
        fragment.appendChild(contents);
        return fragment;
      }

      const firstNode = container.firstChild;
      if (!firstNode) {
        return fragment;
      }

      const partial = extractNodeByHeight(firstNode, limit);
      if (partial) {
        fragment.appendChild(partial);
        return fragment;
      }

      // Fallback: move the node entirely to avoid infinite loops
      fragment.appendChild(firstNode);
      return fragment;
    };

    const measureFragmentHeight = (fragment, templateMain) => {
      if (!fragment || !templateMain) return 0;
      const clonedMain = templateMain.cloneNode(true);
      const body = clonedMain.querySelector('.pleading-body');
      if (!body) return 0;
      body.innerHTML = '';
      body.appendChild(fragment.cloneNode(true));
      testHost.innerHTML = '';
      testHost.appendChild(clonedMain);
      return body.getBoundingClientRect().height;
    };

    const computePages = () => {
      const firstMain = firstTemplate.querySelector('.pleading-main');
      const firstBody = firstTemplate.querySelector('.pleading-body');
      const regularMain = regularTemplate.querySelector('.pleading-main');
      const regularBody = regularTemplate.querySelector('.pleading-body');
      const firstLines = firstTemplate.querySelectorAll('.pleading-line-column span');
      const regularLines = regularTemplate.querySelectorAll('.pleading-line-column span');

      if (!firstMain || !firstBody || !regularMain || !regularBody || !firstLines.length || !regularLines.length) {
        setPages([fallbackHTML()]);
        return;
      }

      const lastFirstLine = firstLines[firstLines.length - 1].getBoundingClientRect().bottom;
      const firstLimit = lastFirstLine - firstBody.getBoundingClientRect().top;
      const lastRegularLine = regularLines[regularLines.length - 1].getBoundingClientRect().bottom;
      const regularLimit = lastRegularLine - regularBody.getBoundingClientRect().top;

      const signatureRow = firstTemplate.querySelector('.signature-row');
      let signatureReserve = 0;
      if (signatureRow) {
        const sigRect = signatureRow.getBoundingClientRect();
        const sigStyles = window.getComputedStyle(signatureRow);
        signatureReserve = sigRect.height
          + parseFloat(sigStyles.marginTop || '0')
          + parseFloat(sigStyles.marginBottom || '0');
      }

      scratch.innerHTML = '';
      const workingMain = firstMain.cloneNode(true);
      scratch.appendChild(workingMain);
      const workingBody = workingMain.querySelector('.pleading-body');
      if (!workingBody) {
        setPages([fallbackHTML()]);
        return;
      }

      const pageFragments = [];
      let isFirstPage = true;

      while (workingBody.childNodes.length) {
        const limit = isFirstPage ? firstLimit : regularLimit;
        let fragment = extractFragmentForHeight(workingBody, limit);

        if (!fragment || !fragment.childNodes.length) {
          break;
        }

        if (!workingBody.childNodes.length) {
          const templateForMeasure = isFirstPage ? firstMain : regularMain;
          const allowed = Math.max(0, limit - signatureReserve);
          if (allowed > 0) {
            let measuredHeight = measureFragmentHeight(fragment, templateForMeasure);
            while (measuredHeight > allowed + HEIGHT_TOLERANCE_PX && fragment.childNodes.length) {
              const lastNode = fragment.lastChild;
              if (!lastNode) break;
              workingBody.insertBefore(lastNode, workingBody.firstChild);
              measuredHeight = measureFragmentHeight(fragment, templateForMeasure);
            }
            if (!fragment.childNodes.length) {
              // All nodes moved back, continue to process remaining content
              continue;
            }
          }
        }

        pageFragments.push({ fragment, isFirstPage });
        isFirstPage = false;
      }

      testHost.innerHTML = '';
      scratch.innerHTML = '';

      if (!pageFragments.length) {
        setPages([fallbackHTML()]);
        return;
      }

      const htmlPages = pageFragments.map(({ fragment }) => {
        const container = document.createElement('div');
        container.appendChild(fragment);
        return container.innerHTML;
      });

      setPages(htmlPages);
    };

    const handleResize = () => {
      requestAnimationFrame(computePages);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    const firstMain = firstTemplate.querySelector('.pleading-main');
    const regularMain = regularTemplate.querySelector('.pleading-main');
    if (firstMain) resizeObserver.observe(firstMain);
    if (regularMain) resizeObserver.observe(regularMain);

    handleResize();

    return () => {
      resizeObserver.disconnect();
      testHost.innerHTML = '';
      scratch.innerHTML = '';
    };
  }, [markdown, heading, title, docDate]);

  return (
    <>
      <div
        ref={measurerRef}
        className="page-measurer"
        aria-hidden
        style={{ position: 'absolute', inset: '-10000px auto auto -10000px', pointerEvents: 'none', visibility: 'hidden' }}
      >
        <div ref={firstTemplateRef} className="pagination-template-first">
          <PleadingPage heading={heading} title={title} firstPage pageNumber={1} totalPages={1} docDate={docDate}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {markdown}
            </ReactMarkdown>
          </PleadingPage>
        </div>
        <div ref={regularTemplateRef} className="pagination-template-regular">
          <PleadingPage heading={heading} title={title} firstPage={false} pageNumber={2} totalPages={2} docDate={docDate}>
            <div className="pagination-placeholder" />
          </PleadingPage>
        </div>
        <div ref={scratchRef} className="pagination-scratch" />
        <div ref={testRef} className="pagination-test" />
      </div>
      {(pages.length ? pages : ['']).map((html, pageIndex) => (
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
            pageNumber={pageIndex + 1}
            totalPages={pages.length || 1}
            docDate={docDate}
          >
            <div className="paginated-markdown-chunk" dangerouslySetInnerHTML={{ __html: html }} />
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
