'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PleadingPage from './PleadingPage';

// Paginate Markdown across multiple pleading pages for on-screen preview
export default function PaginatedMarkdown({ content, heading, title, docDate }) {
  const measurerRef = useRef(null);
  const [pages, setPages] = useState([]);

  // Basic helpers to classify blocks
  const isParagraphBlock = (block) => {
    const trimmed = block.trim();
    if (!trimmed) return true;
    // Non-paragraph starts: headings, lists, blockquotes, tables, code fences
    if (/^(#{1,6})\s/.test(trimmed)) return false;
    if (/^\s*([-*+]\s)/.test(trimmed)) return false;
    if (/^\s*\d+\.\s/.test(trimmed)) return false;
    if (/^\s*>\s?/.test(trimmed)) return false;
    if (/^\s*\|.*\|\s*$/.test(trimmed)) return false;
    if (/^\s*```/.test(trimmed)) return false;
    return true;
  };

  useEffect(() => {
    if (!measurerRef.current) return;

    const root = measurerRef.current;
    const main = root.querySelector('.pleading-main');
    const body = root.querySelector('.pleading-body');
    if (!main || !body) return;

    const cs = window.getComputedStyle(body);
    const lineHeightPx = parseFloat(cs.lineHeight);
    const bodyWidth = body.getBoundingClientRect().width;
    const mainHeight = main.getBoundingClientRect().height;
    const bodyTop = body.getBoundingClientRect().top - main.getBoundingClientRect().top;
    const firstPageAvail = Math.floor((mainHeight - bodyTop) / lineHeightPx);
    const fullPageAvail = Math.floor(mainHeight / lineHeightPx);

    // Prepare canvas for text measurement
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // Match body text font
    ctx.font = `${cs.fontSize || '12pt'} ${cs.fontFamily || 'Times New Roman, Times, serif'}`;

    const wrapParagraphToLines = (text) => {
      const words = text.split(/\s+/);
      const lines = [];
      let current = '';
      words.forEach((w) => {
        const attempt = current ? `${current} ${w}` : w;
        const width = ctx.measureText(attempt).width;
        if (width > bodyWidth && current) {
          lines.push(current);
          current = w;
        } else {
          current = attempt;
        }
      });
      if (current) lines.push(current);
      return lines;
    };

    const blocks = content.split(/\n\n+/); // crude block split
    const outputPages = [];
    let currentPage = [];
    let remainingLines = firstPageAvail;

    const pushPage = () => {
      outputPages.push(currentPage);
      currentPage = [];
      remainingLines = fullPageAvail;
    };

    for (let i = 0; i < blocks.length; i += 1) {
      let block = blocks[i];
      if (!block.trim()) {
        // blank paragraph spacing ~ half line; approximate as 1 line occasionally
        if (remainingLines <= 1) {
          pushPage();
        } else {
          currentPage.push('');
          remainingLines -= 1;
        }
        continue;
      }

      if (!isParagraphBlock(block)) {
        // Measure this block by temporarily rendering it in the measurer body
        const temp = document.createElement('div');
        temp.style.visibility = 'hidden';
        body.appendChild(temp);
        // Render with React into temp is heavy; approximate as 6 lines for small blocks if cannot measure
        temp.textContent = block.replace(/[#$*>`_\-\d\.]/g, '');
        const approxLines = Math.max(1, Math.ceil(temp.getBoundingClientRect().height / lineHeightPx) || 4);
        body.removeChild(temp);
        if (approxLines > remainingLines) {
          pushPage();
        }
        currentPage.push(block);
        remainingLines -= Math.min(remainingLines, approxLines);
      } else {
        // Paragraph: split by lines based on width
        let para = block.replace(/\s+/g, ' ').trim();
        const lines = wrapParagraphToLines(para);
        let start = 0;
        while (start < lines.length) {
          if (remainingLines === 0) pushPage();
          const canTake = Math.min(remainingLines, lines.length - start);
          const slice = lines.slice(start, start + canTake).join(' ');
          currentPage.push(slice);
          start += canTake;
          remainingLines -= canTake;
          if (start < lines.length) pushPage();
        }
        // Add paragraph margin as a spacer line if room
        if (remainingLines === 0) pushPage();
        if (remainingLines > 0) {
          currentPage.push('');
          remainingLines -= 1;
        }
      }
    }

    if (currentPage.length || !outputPages.length) outputPages.push(currentPage);
    setPages(outputPages);
  }, [content, heading, title]);

  // Render hidden measurer and visible pages
  return (
    <>
      <div ref={measurerRef} className="page-measurer" aria-hidden style={{ position: 'absolute', inset: '-10000px auto auto -10000px' }}>
        <PleadingPage heading={heading} title={title} firstPage pageNumber={1} totalPages={1} docDate={docDate}>
          {/* Empty body for measuring sizes */}
        </PleadingPage>
      </div>
      {pages.map((blocks, pageIndex) => (
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
            totalPages={pages.length}
            docDate={docDate}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: (props) => <table className="md-table" {...props} />,
                th: (props) => <th className="md-table-cell" {...props} />,
                td: (props) => <td className="md-table-cell" {...props} />,
              }}
            >
              {blocks.join('\n\n')}
            </ReactMarkdown>
          </PleadingPage>
        </div>
      ))}
    </>
  );
}
