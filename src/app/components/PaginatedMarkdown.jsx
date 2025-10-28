'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

const EPSILON = 0.5;

const serializeNodes = (nodes) => {
  const container = document.createElement('div');
  nodes.forEach((node) => {
    if (node) container.appendChild(node.cloneNode(true));
  });
  return container.innerHTML;
};

const measureHeightFactory = (temp) => (nodes) => {
  if (!temp) return 0;
  const filtered = nodes.filter(Boolean);
  temp.innerHTML = '';
  if (!filtered.length) return 0;
  filtered.forEach((node) => {
    temp.appendChild(node.cloneNode(true));
  });
  const rect = temp.getBoundingClientRect();
  return rect.height;
};

const splitTextNode = (textNode, existingNodes, limit, measure) => {
  const text = textNode.textContent ?? '';
  if (!text) {
    return { fit: null, remainder: null };
  }

  const probe = document.createTextNode('');
  const baseNodes = [...existingNodes, probe];

  let best = 0;
  let low = 0;
  let high = text.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    probe.textContent = text.slice(0, mid);
    const height = measure(baseNodes);
    if (height <= limit + EPSILON) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best === 0) {
    return { fit: null, remainder: document.createTextNode(text) };
  }

  const fitText = text.slice(0, best);
  const remainderText = text.slice(best);

  return {
    fit: document.createTextNode(fitText),
    remainder: remainderText ? document.createTextNode(remainderText) : null,
  };
};

const splitNodeByHeight = (node, existingNodes, limit, measure) => {
  if (!node) return { fit: null, remainder: null };

  if (node.nodeType === Node.TEXT_NODE) {
    return splitTextNode(node, existingNodes, limit, measure);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return { fit: null, remainder: null };
  }

  const head = node.cloneNode(false);
  const tail = node.cloneNode(false);
  const children = Array.from(node.childNodes);

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    const childClone = child.cloneNode(true);
    head.appendChild(childClone);
    const height = measure([...existingNodes, head]);
    if (height <= limit + EPSILON) {
      continue;
    }

    head.removeChild(childClone);
    const { fit, remainder } = splitNodeByHeight(child, [...existingNodes, head], limit, measure);

    if (fit) {
      head.appendChild(fit);
    }

    if (remainder) {
      tail.appendChild(remainder);
    }

    for (let j = i + 1; j < children.length; j += 1) {
      tail.appendChild(children[j].cloneNode(true));
    }

    return {
      fit: head.childNodes.length ? head : null,
      remainder: tail.childNodes.length ? tail : null,
    };
  }

  return {
    fit: head.childNodes.length ? head : null,
    remainder: null,
  };
};

const paginateNodes = (source, temp, firstHeight, standardHeight) => {
  if (!source) return [''];

  const measure = measureHeightFactory(temp);
  const queue = Array.from(source.childNodes).map((node) => node.cloneNode(true));
  const pages = [];
  let currentNodes = [];
  let availableHeight = firstHeight;

  const flushPage = () => {
    if (!currentNodes.length) return;
    pages.push(serializeNodes(currentNodes));
    currentNodes = [];
    availableHeight = standardHeight;
  };

  while (queue.length) {
    let node = queue.shift();
    if (!node) continue;

    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) {
      if (!currentNodes.length) continue;
    }

    while (node) {
      const height = measure([...currentNodes, node]);
      if (height <= availableHeight + EPSILON) {
        currentNodes.push(node);
        node = null;
        break;
      }

      if (currentNodes.length === 0) {
        const { fit, remainder } = splitNodeByHeight(node, currentNodes, availableHeight, measure);
        if (fit) {
          currentNodes.push(fit);
          flushPage();
          node = remainder;
        } else {
          currentNodes.push(remainder || node);
          flushPage();
          node = null;
        }
      } else {
        flushPage();
        availableHeight = standardHeight;
      }
    }
  }

  if (currentNodes.length) {
    flushPage();
  }

  if (!pages.length) {
    pages.push('');
  }

  return pages;
};

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate }) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState(['']);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!measurerRef.current) return undefined;

    const root = measurerRef.current;
    const main = root.querySelector('.pleading-main');
    const body = root.querySelector('.pleading-body');
    if (!main || !body) return undefined;

    const compute = () => {
      const cs = window.getComputedStyle(body);
      const lineHeight = parseFloat(cs.lineHeight) || 1;
      const mainRect = main.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const headerOffset = Math.max(0, bodyRect.top - mainRect.top);
      const maxLines = 28;
      const firstLines = Math.min(maxLines, Math.floor((mainRect.height - headerOffset) / lineHeight));
      const standardLines = Math.min(maxLines, Math.floor(mainRect.height / lineHeight));
      const firstHeight = Math.max(lineHeight, firstLines * lineHeight);
      const standardHeight = Math.max(lineHeight, standardLines * lineHeight);
      setMetrics({
        lineHeight,
        firstHeight,
        standardHeight,
      });
    };

    compute();
    const resizeObserver = new ResizeObserver(() => {
      compute();
    });

    resizeObserver.observe(main);
    resizeObserver.observe(body);

    return () => {
      resizeObserver.disconnect();
    };
  }, [heading, title, docDate]);

  useEffect(() => {
    if (!measurerRef.current || !metrics) return;

    const root = measurerRef.current;
    const body = root.querySelector('.pleading-body');
    const source = body?.querySelector('.markdown-source');
    const temp = body?.querySelector('.pagination-temp');
    if (!body || !source || !temp) return;

    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.pointerEvents = 'none';
    temp.style.left = '0';
    temp.style.right = '0';
    temp.style.top = '0';
    temp.style.width = '100%';

    const pagesHtml = paginateNodes(source, temp, metrics.firstHeight, metrics.standardHeight || metrics.firstHeight);
    setPages(pagesHtml);
  }, [content, metrics, heading, title, docDate]);

  const markdownComponents = useMemo(
    () => ({
      table: (props) => <table className="md-table" {...props} />,
      th: (props) => <th className="md-table-cell" {...props} />,
      td: (props) => <td className="md-table-cell" {...props} />,
    }),
    [],
  );

  return (
    <>
      <div
        ref={measurerRef}
        className="page-measurer"
        aria-hidden
        style={{ position: 'absolute', inset: '-10000px auto auto -10000px' }}
      >
        <PleadingPage heading={heading} title={title} firstPage pageNumber={1} totalPages={1} docDate={docDate}>
          <div className="markdown-source">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content || ''}
            </ReactMarkdown>
          </div>
          <div className="pagination-temp" aria-hidden />
        </PleadingPage>
      </div>
      {pages.map((html, pageIndex) => (
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
            totalPages={pages.length}
            docDate={docDate}
          >
            <div className="markdown-output" dangerouslySetInnerHTML={{ __html: html }} />
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
