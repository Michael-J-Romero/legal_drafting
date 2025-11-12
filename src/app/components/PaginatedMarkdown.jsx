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
// Page-break token that can appear ANYWHERE. Everything after it must start on the next page.
const PAGE_BREAK_TOKEN = "bbb";

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({
  content,
  heading,
  title,
  docDate,
  signatureType = 'default',
  pageOffset = 0,
  totalOverride = null,
  hideHeader = false,
  preTitleCaptions = [],
  suppressTitlePlaceholder = false,
  onPageCount,
  disableSignature = false,
  showPageNumbers = true,
  pageNumberPlacement = 'right',
}) {
  const measurerRef = useRef(null);
  const sourceBodyRef = useRef(null);
  const [pages, setPages] = useState([]);
  // Debug overlays toggle (off by default)
  const [debugEnabled, setDebugEnabled] = useState(false);

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
    (phantom, element, allowedHeight, prevBottomMarginPx = 0) => {
      if (!phantom || !element) return { fit: null, remainder: element };

      const clone = element.cloneNode(true);
      phantom.replaceChildren(clone);

      const computed = window.getComputedStyle(clone);
      const marginTop = parseFloat(computed.marginTop) || 0;
      const topOverlapAllowance = Math.min(prevBottomMarginPx || 0, marginTop);

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

      // Try to fit as many visual lines as possible by measuring actual fragment height
      if (!lineBoundaries.length) {
        const fullHeight = measureElementHeight(phantom, clone.cloneNode(true));
        const allowable = allowedHeight + topOverlapAllowance;
        if (fullHeight <= allowable + MEASURE_TOLERANCE) {
          return { fit: element, remainder: null };
        }
        return { fit: null, remainder: element };
      }

      let bestIndex = 0;
      for (let i = 0; i < lineBoundaries.length; i += 1) {
        const boundary = lineBoundaries[i];
        const fitRange = document.createRange();
        fitRange.setStart(clone, 0);
        fitRange.setEnd(boundary.node, boundary.offset);
        const fitFragment = fitRange.cloneContents();
        const fitElementProbe = element.cloneNode(false);
        fitElementProbe.appendChild(fitFragment);
        fitElementProbe.style.marginBottom = '0px';
        const measured = measureElementHeight(phantom, fitElementProbe.cloneNode(true));
        const allowable = allowedHeight + topOverlapAllowance;
        if (measured <= allowable + MEASURE_TOLERANCE) {
          bestIndex = i + 1; // boundaries are end-inclusive per line
        } else {
          break;
        }
      }

      if (bestIndex <= 0) {
        return { fit: null, remainder: element };
      }

      // If we can fit all lines, return whole element
      if (bestIndex >= lineBoundaries.length) {
        return { fit: element, remainder: null };
      }

      const chosen = lineBoundaries[bestIndex - 1];
      const fitRange = document.createRange();
      fitRange.setStart(clone, 0);
      fitRange.setEnd(chosen.node, chosen.offset);
      const fitFragment = fitRange.cloneContents();

      const remainderRange = document.createRange();
      remainderRange.setStart(chosen.node, chosen.offset);
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

      if (remainderElement.tagName?.toLowerCase() === 'p') {
        remainderElement.classList.add(CONTINUED_BLOCK_CLASS);
      }

      return { fit: fitElement, remainder: remainderElement };
    },
    [measureElementHeight],
  );

  const splitListElement = useCallback((phantom, element, allowedHeight, splitInline, prevBottomMarginPx = 0) => {
    if (!phantom || !element) return { fit: null, remainder: element };
    const computed = window.getComputedStyle(element);
    const marginTop = parseFloat(computed.marginTop) || 0;
    const topOverlapAllowance = Math.min(prevBottomMarginPx || 0, marginTop);

    const listFit = element.cloneNode(false);
    const listRemainder = element.cloneNode(false);
    listFit.style.marginBottom = '0px';
    listRemainder.style.marginTop = '0px';

    const isOrdered = element.tagName?.toLowerCase() === 'ol';
    const startAttr = parseInt(element.getAttribute('start') || '1', 10);
    let numberCursor = Number.isNaN(startAttr) ? 1 : startAttr;
    let consumed = Math.max(0, marginTop - topOverlapAllowance);
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

      const { fit, remainder } = splitInline(phantom, child, remainingHeight, consumed === 0 ? topOverlapAllowance : 0);
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

  // Compute usable capacities purely from geometry (body-to-footer distance),
  // not by capping to a fixed number of lines. This keeps capacity aligned
  // with the actual '.pleading-body' size visible in the preview.
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

  const firstCapacity = Math.max(0, rawFirstCapacity);
  const subsequentCapacity = Math.max(0, rawFollowCapacity);
  const capacityByPage = [firstCapacity, subsequentCapacity];

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
      // Helper: create a sentinel element used to signal a forced page break between blocks
      const createBreakSentinel = () => {
        const el = document.createElement('div');
        el.setAttribute('data-forced-break', '1');
        el.style.display = 'none';
        return el;
      };

      const isBreakSentinel = (node) => node?.nodeType === Node.ELEMENT_NODE && node.getAttribute?.('data-forced-break') === '1';

      const hasMeaningfulContent = (el) => {
        if (!el) return false;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
          acceptNode: (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              return (node.textContent && node.textContent.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Skip our sentinel
              if (isBreakSentinel(node)) return NodeFilter.FILTER_SKIP;
              // Accept any element that could render something
              const tag = node.tagName?.toLowerCase();
              const voids = ['br', 'img', 'hr', 'svg', 'path'];
              if (voids.includes(tag)) return NodeFilter.FILTER_ACCEPT;
              // Otherwise, keep walking
              return NodeFilter.FILTER_SKIP;
            }
            return NodeFilter.FILTER_SKIP;
          },
        });
        return !!walker.nextNode();
      };

      // Recursively split any node's subtree at occurrences of PAGE_BREAK_TOKEN,
      // returning an array of nodes and break sentinels interleaved at boundaries.
      const splitNodeByToken = (node) => {
        if (!node) return [];
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (!text.includes(PAGE_BREAK_TOKEN)) {
            return [node.cloneNode(true)];
          }
          const parts = text.split(PAGE_BREAK_TOKEN);
          const out = [];
          parts.forEach((part, i) => {
            if (part) out.push(document.createTextNode(part));
            if (i < parts.length - 1) out.push(createBreakSentinel());
          });
          return out;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = (node.tagName || '').toLowerCase();
          const isOrderedList = tag === 'ol';
          const baseStartAttr = parseInt(node.getAttribute('start') || '1', 10);
          const baseStart = Number.isNaN(baseStartAttr) ? 1 : baseStartAttr;
          let globalLiCount = 0; // count li encountered in this element across segments

          const cloneShell = () => node.cloneNode(false);
          let current = cloneShell();
          const segments = [];

          const children = Array.from(node.childNodes);
          for (let cIdx = 0; cIdx < children.length; cIdx += 1) {
            const child = children[cIdx];
            const childParts = splitNodeByToken(child);
            for (let pIdx = 0; pIdx < childParts.length; pIdx += 1) {
              const part = childParts[pIdx];
              if (isBreakSentinel(part)) {
                // close current segment if it has any content
                if (hasMeaningfulContent(current)) {
                  segments.push(current);
                }
                // propagate a break sentinel at this level
                segments.push(part);
                // start a new shell and set start for OL continuation
                current = cloneShell();
                if (isOrderedList) {
                  current.setAttribute('start', String(baseStart + globalLiCount));
                }
              } else {
                // Append the part to current
                current.appendChild(part);
                // If a full immediate LI got appended (and wasn't split), bump the counter
                if (isOrderedList && part.nodeType === Node.ELEMENT_NODE && part.tagName?.toLowerCase() === 'li') {
                  // Heuristic: if this LI contains no sentinel descendant, then it was not split here.
                  const containsSentinel = part.querySelector?.('[data-forced-break="1"]');
                  if (!containsSentinel) {
                    globalLiCount += 1;
                  }
                }
              }
            }
          }
          // push trailing segment
          if (hasMeaningfulContent(current) || segments.length === 0) {
            segments.push(current);
          }
          return segments;
        }
        // Other node types (comments etc.)
        return [];
      };

      // Build a block list with break sentinels interleaved
      const rawTopLevel = Array.from(sourceBody.childNodes); // include text just in case
      const blocks = [];
      rawTopLevel.forEach((n) => {
        // ignore whitespace-only text at top-level
        if (n.nodeType === Node.TEXT_NODE && !(n.textContent || '').trim()) return;
        const parts = splitNodeByToken(n);
        parts.forEach((p) => {
          if (p.nodeType === Node.TEXT_NODE) {
            const pEl = document.createElement('p');
            pEl.textContent = p.textContent || '';
            blocks.push(pEl);
          } else {
            blocks.push(p);
          }
        });
      });

  const pagesHtml = [];
  let currentHtml = [];
  let pageIndex = 0;
  let remaining = capacityByPage[pageIndex] || pageCapacityPx;
  // Track previous bottom margin to account for CSS margin-collapsing
  let lastBottomMarginPx = 0;
  // Debug page summaries
  const debugPages = [];
  let currentDebugItems = [];
  let currentPageCapacity = remaining;

      // Detect if a given top-level block should act as a forced page break
      const isPageBreakBlock = (el) => {
        if (!el) return false;
        const tag = (el.tagName || '').toLowerCase();
        if (isBreakSentinel(el)) return true; // our internal sentinel
        if (tag === 'hr') return true; // Optional: hr also forces a break
        // If a top-level element is literally just the token text (rare), treat as break too
        const onlyText = el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE;
        if (onlyText) {
          const text = el.textContent?.trim() || '';
          if (text === PAGE_BREAK_TOKEN) return true;
        }
        return false;
      };

      const finalizePage = () => {
        // Push HTML for this page
        pagesHtml.push(currentHtml.join(''));
        // Record debug info for this page
        const used = Math.max(0, currentPageCapacity - remaining);
        debugPages.push({
          page: pageIndex + 1,
          capacity: currentPageCapacity,
          used,
          remaining,
          items: currentDebugItems,
        });
        // Reset for next page
        currentHtml = [];
        currentDebugItems = [];
        pageIndex += 1;
        remaining = capacityByPage[Math.min(pageIndex, 1)] || pageCapacityPx;
        currentPageCapacity = remaining;
        lastBottomMarginPx = 0;
      };

      const ensureSpace = () => {
        if (currentHtml.length === 0) return;
        finalizePage();
      };

      const processBlock = (node) => {
        if (!node) return;
        // If this is a sentinel, finalize the page and skip rendering
        if (isPageBreakBlock(node)) {
          if (currentHtml.length > 0) {
            finalizePage();
          }
          return;
        }

        let working = node.cloneNode(true);
        while (working) {
          const height = measureElementHeight(phantom, working.cloneNode(true));
          const measuredEl = phantom.firstChild;
          let marginTopPx = 0;
          let marginBottomPx = 0;
          if (measuredEl && measuredEl.nodeType === Node.ELEMENT_NODE) {
            const cs = window.getComputedStyle(measuredEl);
            marginTopPx = parseFloat(cs.marginTop) || 0;
            marginBottomPx = parseFloat(cs.marginBottom) || 0;
          }
          const overlap = Math.min(lastBottomMarginPx, marginTopPx);
          const effectiveHeight = height - overlap;
          if (effectiveHeight <= remaining + MEASURE_TOLERANCE) {
            currentHtml.push(working.outerHTML);
            currentDebugItems.push({
              type: 'block',
              tag: (working.tagName || '').toLowerCase() || '#node',
              eff: effectiveHeight,
              outer: height,
              mt: marginTopPx,
              mb: marginBottomPx,
              overlap,
              text: (working.textContent || '').trim().slice(0, 60),
            });
            remaining -= effectiveHeight;
            lastBottomMarginPx = marginBottomPx;
            working = null;
          } else if (remaining <= MEASURE_TOLERANCE) {
            ensureSpace();
          } else {
            const tag = (working.tagName || '').toLowerCase();
            let splitResult = null;
            if (tag === 'p' || tag === 'blockquote' || tag === 'pre' || tag === 'code' || /^h[1-6]$/.test(tag)) {
              splitResult = splitInlineElement(phantom, working, remaining, lastBottomMarginPx);
            } else if (tag === 'ul' || tag === 'ol') {
              splitResult = splitListElement(phantom, working, remaining, splitInlineElement, lastBottomMarginPx);
            }

            if (!splitResult || (!splitResult.fit && !splitResult.remainder)) {
              ensureSpace();
              const capacityLimit = capacityByPage[Math.min(pageIndex, 1)] || 0;
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
                const fitHeight = measureElementHeight(phantom, fit.cloneNode(true));
                const fitEl = phantom.firstChild;
                let fitTop = 0; let fitBottom = 0;
                if (fitEl && fitEl.nodeType === Node.ELEMENT_NODE) {
                  const cs2 = window.getComputedStyle(fitEl);
                  fitTop = parseFloat(cs2.marginTop) || 0;
                  fitBottom = parseFloat(cs2.marginBottom) || 0;
                }
                const fitOverlap = Math.min(lastBottomMarginPx, fitTop);
                const fitEffective = fitHeight - fitOverlap;
                currentHtml.push(fit.outerHTML);
                currentDebugItems.push({
                  type: 'fragment',
                  tag: (fit.tagName || '').toLowerCase() || '#node',
                  eff: fitEffective,
                  outer: fitHeight,
                  mt: fitTop,
                  mb: fitBottom,
                  overlap: fitOverlap,
                  text: (fit.textContent || '').trim().slice(0, 60),
                });
                remaining -= fitEffective;
                lastBottomMarginPx = fitBottom;
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
        // finalize last page too
        finalizePage();
      }
      if (!pagesHtml.length) pagesHtml.push('');

      // Produce a printable summary log of pagination
      const round = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
      const printable = debugPages.map((p) => ({
        page: p.page,
        capacity: round(p.capacity),
        used: round(p.used),
        remaining: round(p.remaining),
        items: p.items.map((it, idx) => ({
          idx: idx + 1,
          type: it.type,
          tag: it.tag,
          eff: round(it.eff),
          outer: round(it.outer),
          mt: round(it.mt),
          mb: round(it.mb),
          overlap: round(it.overlap),
          text: it.text,
        })),
      }));
      // eslint-disable-next-line no-console
      console.log('test2', printable);

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

  // Hotkey: Ctrl+Shift+D to toggle debug overlays and outlines
  useEffect(() => {
    const onKey = (e) => {
      try {
        const key = (e.key || '').toLowerCase();
        if (e.ctrlKey && e.altKey && key === 'd') {
          e.preventDefault();
          setDebugEnabled((v) => !v);
        }
      } catch (_) {}
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debug: draw overlay rectangles for each measured block and the remaining space
  useLayoutEffect(() => {
    // Always clear any existing overlays first
    Array.from(document.querySelectorAll('[data-debug-overlays]')).forEach((el) => {
      try { el.remove(); } catch (_) {}
    });
    if (!debugEnabled) return () => {};

    // Only run when we have rendered pages in the DOM and debug is enabled
    const wrappers = Array.from(document.querySelectorAll('.page-wrapper'));
    const cleanup = [];
    wrappers.forEach((wrap) => {
      const body = wrap.querySelector('.pleading-body');
      const md = wrap.querySelector('.pleading-rendered-markdown');
      if (!body || !md) return;

      // Layer that holds all overlays for this page
      const layer = document.createElement('div');
      layer.setAttribute('data-debug-overlays', '1');
      Object.assign(layer.style, {
        position: 'absolute',
        inset: '0px',
        pointerEvents: 'none',
        zIndex: 5,
      });
      body.appendChild(layer);
      cleanup.push(() => layer.remove());

      const bodyRect = body.getBoundingClientRect();
      let prevBottomMargin = 0;
      let lastBottom = 0;

      const blocks = Array.from(md.children).filter((el) => el.nodeType === Node.ELEMENT_NODE);
      blocks.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        const mt = parseFloat(cs.marginTop) || 0;
        const mb = parseFloat(cs.marginBottom) || 0;
        const outerHeight = rect.height + mt + mb;
        const overlap = Math.min(prevBottomMargin, mt);
        const effectiveHeight = outerHeight - overlap;

        const topWithinBody = rect.top - bodyRect.top; // border-box top inside body
        const overlayTop = Math.max(0, topWithinBody - overlap);

        const blockOverlay = document.createElement('div');
        Object.assign(blockOverlay.style, {
          position: 'absolute',
          left: '0px',
          width: '100%',
          top: `${overlayTop}px`,
          height: `${Math.max(0, effectiveHeight)}px`,
          background: 'rgba(255,0,0,0.08)',
          border: '1px solid rgba(255,0,0,0.6)',
          boxSizing: 'border-box',
        });

        const label = document.createElement('div');
        label.textContent = `#${idx + 1} eff:${effectiveHeight.toFixed(1)} outer:${outerHeight.toFixed(1)} mt:${mt.toFixed(1)} mb:${mb.toFixed(1)} overlap:${overlap.toFixed(1)}`;
        Object.assign(label.style, {
          position: 'absolute',
          top: `${overlayTop + 2}px`,
          right: '2px',
          fontSize: '10px',
          color: '#900',
          background: 'rgba(255,255,255,0.8)',
          padding: '1px 3px',
          borderRadius: '2px',
          border: '1px solid rgba(255,0,0,0.4)'
        });

        layer.appendChild(blockOverlay);
        layer.appendChild(label);

        lastBottom = Math.max(lastBottom, overlayTop + Math.max(0, effectiveHeight));
        prevBottomMargin = mb;
      });

      // Remaining space overlay in the body
      const bodyHeight = body.getBoundingClientRect().height;
      const remainingHeight = Math.max(0, bodyHeight - lastBottom);
      if (remainingHeight > 0) {
        const remainOverlay = document.createElement('div');
        Object.assign(remainOverlay.style, {
          position: 'absolute',
          left: '0px',
          width: '100%',
          top: `${lastBottom}px`,
          height: `${remainingHeight}px`,
          background: 'rgba(0,128,255,0.08)',
          borderTop: '2px dashed rgba(0,128,255,0.6)',
          boxSizing: 'border-box',
        });

        const remainLabel = document.createElement('div');
        remainLabel.textContent = `remaining:${remainingHeight.toFixed(1)}px`;
        Object.assign(remainLabel.style, {
          position: 'absolute',
          top: `${lastBottom + 2}px`,
          left: '2px',
          fontSize: '10px',
          color: '#085',
          background: 'rgba(255,255,255,0.8)',
          padding: '1px 3px',
          borderRadius: '2px',
          border: '1px solid rgba(0,128,255,0.4)'
        });

        layer.appendChild(remainOverlay);
        layer.appendChild(remainLabel);
      }
    });

    return () => {
      cleanup.forEach((fn) => fn());
    };
  }, [pages, debugEnabled]);

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
            signatureType={signatureType}
            hideHeaderBlocks={hideHeader}
            preTitleCaptions={preTitleCaptions}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={false}
            showPageNumbers={showPageNumbers}
            pageNumberPlacement={pageNumberPlacement}
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
            signatureType={signatureType}
            hideHeaderBlocks={hideHeader}
            preTitleCaptions={preTitleCaptions}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={false}
            showPageNumbers={showPageNumbers}
            pageNumberPlacement={pageNumberPlacement}
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
            signatureType={signatureType}
            suppressTitlePlaceholder={suppressTitlePlaceholder}
            showSignature={disableSignature ? false : pageIndex === pages.length - 1}
            debugLayout={debugEnabled}
            showPageNumbers={showPageNumbers}
            pageNumberPlacement={pageNumberPlacement}
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
