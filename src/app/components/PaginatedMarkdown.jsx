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
const CONTINUED_BLOCK_CLASS = 'pleading-continued-block';

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

  const splitInlineElement = useCallback(
    (phantom, element, allowedHeight, nextPageCapacity = null) => {
      if (!phantom || !element) return { fit: null, remainder: element };

      const clone = element.cloneNode(true);
      phantom.replaceChildren(clone);

      const computed = window.getComputedStyle(clone);
      const marginTop = parseFloat(computed.marginTop) || 0;
      if (allowedHeight <= marginTop + MEASURE_TOLERANCE) {
        return { fit: null, remainder: element };
      }

      const availableContent = allowedHeight - marginTop;
      const lineHeightValue = parseFloat(computed.lineHeight);
      const resolvedLineHeight = Number.isFinite(lineHeightValue) && lineHeightValue > 0
        ? lineHeightValue
        : computeLineHeight(clone);

      if (!resolvedLineHeight || resolvedLineHeight <= 0) {
        return { fit: null, remainder: element };
      }

      const maxLines = Math.floor((availableContent + MEASURE_TOLERANCE) / resolvedLineHeight);
      if (maxLines <= 0) {
        return { fit: null, remainder: element };
      }

      const range = document.createRange();
      range.setStart(clone, 0);
      range.setEnd(clone, 0);

      const lineBoundaries = [];

      const collectLastRect = () => {
        const rects = range.getClientRects();
        let lastRect = null;
        for (let i = 0; i < rects.length; i += 1) {
          const rect = rects[i];
          if (!rect || rect.width === 0 || rect.height === 0) continue;
          if (!lastRect || rect.bottom > lastRect.bottom + MEASURE_TOLERANCE ||
            (Math.abs(rect.bottom - lastRect.bottom) <= MEASURE_TOLERANCE && rect.right > lastRect.right)) {
            lastRect = rect;
          }
        }
        return lastRect;
      };

      const walker = document.createTreeWalker(
        clone,
        NodeFilter.SHOW_ALL,
        {
          acceptNode: (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              return node.textContent?.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          },
        },
      );

      let previousLocation = { node: clone, offset: 0 };
      let lastBottom = null;
      let node = walker.nextNode();

      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const textLength = node.textContent?.length || 0;
          for (let i = 1; i <= textLength; i += 1) {
            const nextLocation = { node, offset: i };
            range.setEnd(node, i);
            const lastRect = collectLastRect();
            if (lastRect) {
              if (lastBottom !== null && lastRect.bottom > lastBottom + MEASURE_TOLERANCE) {
                lineBoundaries.push({ node: previousLocation.node, offset: previousLocation.offset });
              }
              if (lastBottom === null || lastRect.bottom > lastBottom + MEASURE_TOLERANCE) {
                lastBottom = lastRect.bottom;
              }
            }
            previousLocation = nextLocation;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
          const parent = node.parentNode;
          if (parent) {
            const siblings = Array.from(parent.childNodes);
            const index = siblings.indexOf(node);
            const nextLocation = { node: parent, offset: index + 1 };
            range.setEnd(parent, nextLocation.offset);
            const lastRect = collectLastRect();
            if (lastRect) {
              if (lastBottom !== null && lastRect.bottom > lastBottom + MEASURE_TOLERANCE) {
                lineBoundaries.push({ node: previousLocation.node, offset: previousLocation.offset });
              }
              if (lastBottom === null || lastRect.bottom > lastBottom + MEASURE_TOLERANCE) {
                lastBottom = lastRect.bottom;
              }
            }
            previousLocation = nextLocation;
          }
        }

        node = walker.nextNode();
      }

      const finalRect = collectLastRect();
      if (finalRect) {
        if (lastBottom === null || finalRect.bottom > lastBottom + MEASURE_TOLERANCE) {
          lastBottom = finalRect.bottom;
        }
        lineBoundaries.push({ node: range.endContainer, offset: range.endOffset });
      }

      range.detach?.();

      if (!lineBoundaries.length) {
        const fullHeight = measureElementHeight(phantom, clone.cloneNode(true));
        if (fullHeight <= allowedHeight + MEASURE_TOLERANCE) {
          return { fit: element, remainder: null };
        }
        return { fit: null, remainder: element };
      }

      const totalLines = lineBoundaries.length;
      if (totalLines <= maxLines) {
        return { fit: element, remainder: null };
      }

      const boundary = lineBoundaries[Math.max(0, maxLines - 1)];
      if (!boundary) {
        return { fit: null, remainder: element };
      }

      const fitRange = document.createRange();
      fitRange.setStart(clone, 0);
      fitRange.setEnd(boundary.node, boundary.offset);
      const fitFragment = fitRange.cloneContents();

      const remainderRange = document.createRange();
      remainderRange.setStart(boundary.node, boundary.offset);
      remainderRange.setEnd(clone, clone.childNodes.length);
      const remainderFragment = remainderRange.cloneContents();

      const fitElement = element.cloneNode(false);
      fitElement.appendChild(fitFragment);
      fitElement.style.marginBottom = '0px';

      const remainderElement = element.cloneNode(false);
      remainderElement.appendChild(remainderFragment);
      remainderElement.style.marginTop = '0px';

      if (!remainderElement.textContent?.trim()) {
        return { fit: fitElement, remainder: null };
      }

      // Check for widow prevention: ensure remainder has at least 2 lines
      if (nextPageCapacity !== null && resolvedLineHeight > 0) {
        // Count lines in remainder by measuring it
        phantom.replaceChildren(remainderElement.cloneNode(true));
        const remainderClone = phantom.firstChild;
        if (remainderClone) {
          const remainderStyle = window.getComputedStyle(remainderClone);
          const remainderMarginTop = parseFloat(remainderStyle.marginTop) || 0;
          const remainderMarginBottom = parseFloat(remainderStyle.marginBottom) || 0;
          const remainderRect = remainderClone.getBoundingClientRect();
          const remainderContentHeight = remainderRect.height - remainderMarginTop - remainderMarginBottom;
          const estimatedRemainderLines = Math.round(remainderContentHeight / resolvedLineHeight);
          
          // If remainder would be only 1 line (widow), try to move one more line to it
          if (estimatedRemainderLines < 2 && maxLines > 1) {
            // Try splitting at one line earlier
            const newBoundary = lineBoundaries[Math.max(0, maxLines - 2)];
            if (newBoundary) {
              const newFitRange = document.createRange();
              newFitRange.setStart(clone, 0);
              newFitRange.setEnd(newBoundary.node, newBoundary.offset);
              const newFitFragment = newFitRange.cloneContents();

              const newRemainderRange = document.createRange();
              newRemainderRange.setStart(newBoundary.node, newBoundary.offset);
              newRemainderRange.setEnd(clone, clone.childNodes.length);
              const newRemainderFragment = newRemainderRange.cloneContents();

              const newFitElement = element.cloneNode(false);
              newFitElement.appendChild(newFitFragment);
              newFitElement.style.marginBottom = '0px';

              const newRemainderElement = element.cloneNode(false);
              newRemainderElement.appendChild(newRemainderFragment);
              newRemainderElement.style.marginTop = '0px';

              if (newRemainderElement.textContent?.trim()) {
                if (newRemainderElement.tagName?.toLowerCase() === 'p') {
                  newRemainderElement.classList.add(CONTINUED_BLOCK_CLASS);
                }
                return { fit: newFitElement, remainder: newRemainderElement };
              }
            }
          }
        }
      }

      if (remainderElement.tagName?.toLowerCase() === 'p') {
        remainderElement.classList.add(CONTINUED_BLOCK_CLASS);
      }

      return { fit: fitElement, remainder: remainderElement };
    },
    [computeLineHeight, measureElementHeight],
  );

  const splitListElement = useCallback((phantom, element, allowedHeight, splitInline, nextPageCapacity = null) => {
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

      const { fit, remainder } = splitInline(phantom, child, remainingHeight, nextPageCapacity);
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
    phantom.style.position = 'absolute';
    phantom.style.visibility = 'hidden';
    phantom.style.pointerEvents = 'none';
    phantom.style.left = '-10000px';
    phantom.style.top = '0px';
    phantom.style.width = `${followBody.getBoundingClientRect().width}px`;
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

      const processBlock = (node, blockIndex, allBlocks) => {
        if (!node) return;
        let working = node.cloneNode(true);
        const tag = (working.tagName || '').toLowerCase();
        const isHeading = /^h[1-6]$/.test(tag);
        
        // Check for consecutive headings that should stay together
        let consecutiveHeadings = [];
        if (isHeading) {
          consecutiveHeadings.push(node);
          // Look ahead for consecutive headings
          for (let i = blockIndex + 1; i < allBlocks.length; i += 1) {
            const nextBlock = allBlocks[i];
            const nextTag = (nextBlock.tagName || '').toLowerCase();
            if (/^h[1-6]$/.test(nextTag)) {
              consecutiveHeadings.push(nextBlock);
            } else {
              break;
            }
          }
        }
        
        // If we have consecutive headings, check if they should move together
        if (consecutiveHeadings.length > 1 && currentHtml.length > 0) {
          // Calculate total height of consecutive headings
          let totalHeadingHeight = 0;
          for (const heading of consecutiveHeadings) {
            totalHeadingHeight += measureElementHeight(phantom, heading.cloneNode(true));
          }
          
          // If headings don't fit on current page, move them all to next page
          if (totalHeadingHeight > remaining + MEASURE_TOLERANCE) {
            ensureSpace();
          }
        }
        
        while (working) {
          const height = measureElementHeight(phantom, working.cloneNode(true));
          const nextPageCapacity = capacityByPage[Math.min(pageIndex + 1, 1)] || pageCapacityPx;
          
          if (height <= remaining + MEASURE_TOLERANCE) {
            currentHtml.push(working.outerHTML);
            remaining -= height;
            working = null;
          } else if (remaining <= MEASURE_TOLERANCE) {
            ensureSpace();
          } else {
            let splitResult = null;
            if (tag === 'p' || tag === 'blockquote' || tag === 'pre' || tag === 'code' || /^h[1-6]$/.test(tag)) {
              splitResult = splitInlineElement(phantom, working, remaining, nextPageCapacity);
            } else if (tag === 'ul' || tag === 'ol') {
              splitResult = splitListElement(phantom, working, remaining, splitInlineElement, nextPageCapacity);
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

      blocks.forEach((block, index) => processBlock(block, index, blocks));
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
