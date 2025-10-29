'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

const MEASURE_TOLERANCE = 0.5; // px tolerance for floating point rounding

const MARKDOWN_COMPONENTS = {
  table: (props) => <table className="md-table" {...props} />,
  th: (props) => <th className="md-table-cell" {...props} />,
  td: (props) => <td className="md-table-cell" {...props} />,
};

const CONTINUATION_CLASS = 'pleading-continued-li';

// Paginate Markdown across multiple pleading pages for on-screen preview
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
  const sourceBodyRef = useRef(null);
  const [pages, setPages] = useState([]);

  const normalizedContent = useMemo(() => content || '', [content]);

  const computeLineHeight = (element) => {
    if (!element) return 0;
    const sample = element.querySelector('p, li, div, span, h1, h2, h3, h4, h5, h6');
    const target = sample || element;
    const style = window.getComputedStyle(target);
    let lh = parseFloat(style.lineHeight);
    if (Number.isNaN(lh) || !Number.isFinite(lh)) {
      const fontSize = parseFloat(style.fontSize);
      lh = Number.isFinite(fontSize) ? fontSize * 1.2 : 16;
    }
    return lh;
  };

  const measureElementHeight = useCallback((phantom, element) => {
    if (!phantom || !element) return 0;
    const clone = element.cloneNode(true);
    phantom.replaceChildren(clone);
    const rect = clone.getBoundingClientRect();
    const computed = window.getComputedStyle(clone);
    const marginTop = parseFloat(computed.marginTop) || 0;
    const marginBottom = parseFloat(computed.marginBottom) || 0;
    return rect.height + marginTop + marginBottom;
  }, []);

  const splitInlineElement = useCallback((phantom, element, allowedHeight) => {
    if (!phantom || !element) return { fit: null, remainder: element };

    const clone = element.cloneNode(true);
    phantom.replaceChildren(clone);

    const computed = window.getComputedStyle(clone);
    const marginTop = parseFloat(computed.marginTop) || 0;
    if (allowedHeight <= marginTop + MEASURE_TOLERANCE) {
      return { fit: null, remainder: element };
    }

    const availableContent = allowedHeight - marginTop;

    const range = document.createRange();
    range.setStart(clone, 0);
    range.collapse(true);

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node || !node.nodeValue) return NodeFilter.FILTER_SKIP;
        return node.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    const lineBreaks = [];
    const countLines = (rectList) => {
      if (!rectList || rectList.length === 0) return 0;
      const tops = [];
      rectList.forEach((rect) => {
        const roundedTop = Math.round(rect.top * 100) / 100;
        if (!tops.some((value) => Math.abs(value - roundedTop) <= 0.1)) {
          tops.push(roundedTop);
        }
      });
      return tops.length;
    };

    let prevNode = null;
    let prevOffset = 0;
    let prevHeight = 0;
    let prevLineCount = 0;

    while (true) {
      const textNode = walker.nextNode();
      if (!textNode) break;
      const nodeLength = textNode.textContent.length;
      for (let offset = 1; offset <= nodeLength; offset += 1) {
        range.setEnd(textNode, offset);
        const rects = range.getClientRects();
        const lineCount = countLines(rects);
        const totalHeight = rects.length ? range.getBoundingClientRect().height : 0;

        if (lineCount > prevLineCount && prevNode) {
          lineBreaks.push({ node: prevNode, offset: prevOffset, height: prevHeight });
        }

        prevNode = textNode;
        prevOffset = offset;
        prevHeight = totalHeight;
        prevLineCount = lineCount;
      }
    }

    if (prevNode) {
      lineBreaks.push({ node: prevNode, offset: prevOffset, height: prevHeight });
    }

    if (!lineBreaks.length) {
      return { fit: null, remainder: element };
    }

    const firstOverIndex = lineBreaks.findIndex((line) => line.height > availableContent + MEASURE_TOLERANCE);

    if (firstOverIndex === -1) {
      return { fit: element, remainder: null };
    }

    if (firstOverIndex === 0) {
      return { fit: null, remainder: element };
    }

    const breakPoint = lineBreaks[firstOverIndex - 1];

    const originalMarginBottom = computed.marginBottom || '0px';

    const fitRange = document.createRange();
    fitRange.setStart(clone, 0);
    fitRange.setEnd(breakPoint.node, breakPoint.offset);
    const fitFragment = fitRange.cloneContents();
    const fitElement = element.cloneNode(false);
    fitElement.appendChild(fitFragment);

    const tailRange = document.createRange();
    tailRange.setStart(breakPoint.node, breakPoint.offset);
    tailRange.setEnd(clone, clone.childNodes.length);
    const remainderFragment = tailRange.cloneContents();
    const remainderElement = element.cloneNode(false);
    remainderElement.appendChild(remainderFragment);
    remainderElement.style.marginTop = '0px';

    if (!remainderElement.textContent?.trim()) {
      fitElement.style.marginBottom = originalMarginBottom;
      return { fit: fitElement, remainder: null };
    }

    fitElement.style.marginBottom = '0px';

    return { fit: fitElement, remainder: remainderElement };
  }, []);

  const splitListElement = useCallback((phantom, element, allowedHeight, splitInline) => {
    if (!phantom || !element) return { fit: null, remainder: element };
    const computed = window.getComputedStyle(element);
    const marginTop = parseFloat(computed.marginTop) || 0;
    if (allowedHeight <= marginTop + MEASURE_TOLERANCE) {
      return { fit: null, remainder: element };
    }

    const listFit = element.cloneNode(false);
    const listRemainder = element.cloneNode(false);
    listFit.style.marginBottom = '0px';
    listRemainder.style.marginTop = '0px';

    const isOrdered = element.tagName?.toLowerCase() === 'ol';
    const startAttr = parseInt(element.getAttribute('start') || '1', 10);
    let numberCursor = Number.isNaN(startAttr) ? 1 : startAttr;
    let consumed = marginTop;
    const children = Array.from(element.children);
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      const measureWrapper = element.cloneNode(false);
      measureWrapper.style.marginTop = '0px';
      measureWrapper.style.marginBottom = '0px';
      measureWrapper.appendChild(child.cloneNode(true));
      const childHeight = measureElementHeight(phantom, measureWrapper);
      if (consumed + childHeight <= allowedHeight + MEASURE_TOLERANCE) {
        const childClone = child.cloneNode(true);
        if (isOrdered) {
          childClone.setAttribute('value', String(numberCursor));
        }
        listFit.appendChild(childClone);
        consumed += childHeight;
        numberCursor += 1;
        continue;
      }

      const remainingHeight = Math.max(0, allowedHeight - consumed);
      if (remainingHeight <= MEASURE_TOLERANCE) {
        for (let j = i; j < children.length; j += 1) {
          const restClone = children[j].cloneNode(true);
          if (isOrdered) {
            restClone.setAttribute('value', String(numberCursor));
            numberCursor += 1;
          }
          listRemainder.appendChild(restClone);
        }
        break;
      }

      const { fit, remainder } = splitInline(phantom, child, remainingHeight);
      if (fit) {
        if (isOrdered) {
          fit.setAttribute('value', String(numberCursor));
        }
        listFit.appendChild(fit);
        numberCursor += 1;
      }
      if (remainder) {
        remainder.classList.add(CONTINUATION_CLASS);
        if (isOrdered) {
          remainder.setAttribute('value', String(numberCursor - 1));
        }
        listRemainder.appendChild(remainder);
      }
      for (let j = i + 1; j < children.length; j += 1) {
        const clone = children[j].cloneNode(true);
        if (isOrdered) {
          clone.setAttribute('value', String(numberCursor));
          numberCursor += 1;
        }
        listRemainder.appendChild(clone);
      }
      break;
    }

    if (!listFit.children.length) {
      return { fit: null, remainder: element };
    }

    if (!listRemainder.children.length) {
      return { fit: listFit, remainder: null };
    }

    return { fit: listFit, remainder: listRemainder };
  }, [measureElementHeight]);

  const buildPages = useCallback(() => {
    const measurer = measurerRef.current;
    const sourceBody = sourceBodyRef.current;
    if (!measurer || !sourceBody) return;

    const firstMain = measurer.querySelector('[data-measure-first] .pleading-main');
    const firstBody = measurer.querySelector('[data-measure-first] .pleading-body');
    const followMain = measurer.querySelector('[data-measure-follow] .pleading-main');
    const followBody = measurer.querySelector('[data-measure-follow] .pleading-body');

    if (!firstMain || !firstBody || !followMain || !followBody) return;

    const lineHeight = computeLineHeight(firstBody);
    if (!lineHeight) return;

    const pageCapacityPx = lineHeight * 28;
    const firstMainRect = firstMain.getBoundingClientRect();
    const firstBodyRect = firstBody.getBoundingClientRect();
    const firstFooterRect = firstMain.querySelector('.page-footer')?.getBoundingClientRect();
    const firstFooterHeight = firstFooterRect ? firstFooterRect.height : 0;
    const firstOffset = firstBodyRect.top - firstMainRect.top;
    const rawFirstCapacity = firstMainRect.height - firstOffset - firstFooterHeight;

    const followMainRect = followMain.getBoundingClientRect();
    const followBodyRect = followBody.getBoundingClientRect();
    const followFooterRect = followMain.querySelector('.page-footer')?.getBoundingClientRect();
    const followFooterHeight = followFooterRect ? followFooterRect.height : 0;
    const followOffset = followBodyRect.top - followMainRect.top;
    const rawFollowCapacity = followMainRect.height - followOffset - followFooterHeight;

    const firstCapacity = Math.max(0, Math.min(pageCapacityPx, rawFirstCapacity));
    const subsequentCapacity = Math.max(0, Math.min(pageCapacityPx, rawFollowCapacity));
    const capacityByPage = [firstCapacity || pageCapacityPx, subsequentCapacity || pageCapacityPx];

    const phantom = followBody.cloneNode(false);
    const followComputed = window.getComputedStyle(followBody);
    phantom.style.position = 'absolute';
    phantom.style.visibility = 'hidden';
    phantom.style.pointerEvents = 'none';
    phantom.style.left = '0px';
    phantom.style.top = '0px';
    phantom.style.width = `${followBody.getBoundingClientRect().width}px`;
    phantom.style.font = followComputed.font;
    phantom.style.whiteSpace = followComputed.whiteSpace;
    phantom.style.letterSpacing = followComputed.letterSpacing;
    phantom.style.wordSpacing = followComputed.wordSpacing;
    phantom.style.lineHeight = followComputed.lineHeight;
    phantom.style.padding = followComputed.padding;
    phantom.style.borderLeft = `${followComputed.borderLeftWidth} ${followComputed.borderLeftStyle} ${followComputed.borderLeftColor}`;
    phantom.style.borderRight = `${followComputed.borderRightWidth} ${followComputed.borderRightStyle} ${followComputed.borderRightColor}`;
    phantom.style.boxSizing = followComputed.boxSizing;
    followBody.parentElement.appendChild(phantom);

    const flushPhantom = () => {
      if (phantom.parentElement) {
        phantom.parentElement.removeChild(phantom);
      }
    };

    try {
      const blocks = Array.from(sourceBody.children);
      const pagesHtml = [];
      let currentHtml = [];
      let pageIndex = 0;
      let remaining = capacityByPage[pageIndex] || pageCapacityPx;

      const finalizePage = () => {
        pagesHtml.push(currentHtml.join(''));
        currentHtml = [];
        pageIndex += 1;
        remaining = capacityByPage[Math.min(pageIndex, 1)] || pageCapacityPx;
      };

      const ensureSpace = () => {
        if (currentHtml.length === 0) return;
        finalizePage();
      };

      const processBlock = (node) => {
        if (!node) return;
        let working = node.cloneNode(true);
        while (working) {
          const height = measureElementHeight(phantom, working.cloneNode(true));
          if (height <= remaining + MEASURE_TOLERANCE) {
            currentHtml.push(working.outerHTML);
            remaining -= height;
            working = null;
          } else if (remaining <= MEASURE_TOLERANCE) {
            ensureSpace();
          } else {
            const tag = (working.tagName || '').toLowerCase();
            let splitResult = null;
            if (tag === 'p' || tag === 'blockquote' || tag === 'pre' || tag === 'code' || /^h[1-6]$/.test(tag)) {
              splitResult = splitInlineElement(phantom, working, remaining);
            } else if (tag === 'ul' || tag === 'ol') {
              splitResult = splitListElement(phantom, working, remaining, splitInlineElement);
            }

            if (!splitResult || (!splitResult.fit && !splitResult.remainder)) {
              ensureSpace();
              const capacityLimit = capacityByPage[Math.min(pageIndex, 1)] || pageCapacityPx;
              if (remaining === capacityLimit) {
                if (height > capacityLimit + MEASURE_TOLERANCE) {
                  currentHtml.push(working.outerHTML);
                  remaining = 0;
                  working = null;
                } else {
                  currentHtml.push(working.outerHTML);
                  remaining = 0;
                  working = null;
                }
              }
            } else {
              const { fit, remainder } = splitResult;
              if (fit) {
                currentHtml.push(fit.outerHTML);
                remaining -= measureElementHeight(phantom, fit.cloneNode(true));
              }
              ensureSpace();
              working = remainder;
              if (working && !working.textContent?.trim()) {
                working = null;
              }
            }
          }
          if (remaining <= MEASURE_TOLERANCE && working === null && currentHtml.length) {
            finalizePage();
          }
        }
      };

      blocks.forEach(processBlock);
      if (currentHtml.length) {
        pagesHtml.push(currentHtml.join(''));
      }
      if (!pagesHtml.length) pagesHtml.push('');

      setPages(pagesHtml);
    } finally {
      flushPhantom();
    }
  }, [computeLineHeight, measureElementHeight, splitInlineElement, splitListElement]);

  useLayoutEffect(() => {
    if (!measurerRef.current) return undefined;

    let frame = null;
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        buildPages();
      });
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(measurerRef.current);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [buildPages, normalizedContent, heading, title, hideHeader, preTitleCaptions, suppressTitlePlaceholder]);

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
        ref={measurerRef}
        className="page-measurer"
        aria-hidden
        style={{ position: 'absolute', inset: '-10000px auto auto -10000px' }}
      >
        <div data-measure-first>
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
            <div ref={sourceBodyRef} data-measure-source>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                {normalizedContent}
              </ReactMarkdown>
            </div>
          </PleadingPage>
        </div>
        <div data-measure-follow>
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
            totalPages={typeof totalOverride === 'number' ? totalOverride : pageOffset + pages.length}
            docDate={docDate}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={disableSignature ? false : pageIndex === pages.length - 1}
          >
            <div
              className="pleading-rendered-markdown"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
