import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Document, Page, pdfjs } from 'react-pdf';
import { useReactToPrint } from 'react-to-print';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import removeMarkdown from 'remove-markdown';
import './App.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

let fragmentCounter = 0;

const LETTER_WIDTH = 612; // 8.5in * 72
const LETTER_HEIGHT = 792; // 11in * 72
const PAGE_PREVIEW_WIDTH = Math.round(8.5 * 96);

function createFragmentId() {
  fragmentCounter += 1;
  return `fragment-${fragmentCounter}`;
}

const LINE_COUNT = 28;

function MarkdownPreview({ content, heading, pageNumber }) {
  const {
    topLeftFields,
    captionRightFields,
    plaintiffName,
    defendantName,
    courtName,
    caseNumber,
    documentTitle,
  } = heading;

  const safeTopLeft = topLeftFields.length ? topLeftFields : [''];
  const safeCaptionRight = captionRightFields.length ? captionRightFields : [''];
  const normalizedPlaintiff = (plaintiffName || 'Plaintiff Name').toUpperCase();
  const normalizedDefendant = (defendantName || 'Defendant Name').toUpperCase();
  const normalizedTitle = (documentTitle || 'Document Title').toUpperCase();

  return (
    <div className="page-surface markdown-fragment">
      <div className="pleading-paper">
        <div className="pleading-top">
          <div className="pleading-top-left">
            {safeTopLeft.map((field, index) => (
              <div key={`left-field-${index}`} className="pleading-top-line">
                {field || <span className="placeholder">&nbsp;</span>}
              </div>
            ))}
          </div>
          <div className="pleading-top-right" />
        </div>

        <div className="pleading-caption">
          <div className="pleading-caption-left">
            <span className="pleading-party">{normalizedPlaintiff}</span>
            <span className="pleading-versus">v.</span>
            <span className="pleading-party">{normalizedDefendant}</span>
          </div>
          <div className="pleading-caption-divider" />
          <div className="pleading-caption-right">
            <div className="caption-case-number">{caseNumber || 'Case No. ______'}</div>
            {safeCaptionRight.map((field, index) => (
              <div key={`right-field-${index}`} className="pleading-caption-line">
                {field || <span className="placeholder">&nbsp;</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="pleading-court">{courtName || 'SUPERIOR COURT OF CALIFORNIA'}</div>
        <div className="pleading-title">{normalizedTitle}</div>

        <div className="pleading-body">
          <div className="pleading-line-numbers">
            {Array.from({ length: LINE_COUNT }, (_, index) => (
              <div key={`line-${index}`} className="pleading-line-number">
                {index + 1}
              </div>
            ))}
          </div>
          <div className="pleading-body-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: (props) => <table className="md-table" {...props} />,
                th: (props) => <th className="md-table-cell" {...props} />,
                td: (props) => <td className="md-table-cell" {...props} />,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

        <div className="pleading-footer">
          <span className="pleading-footer-title">{normalizedTitle}</span>
          <span className="pleading-footer-page">Page {pageNumber}</span>
        </div>
      </div>
    </div>
  );
}

function PdfPreview({ data }) {
  const [numPages, setNumPages] = useState(null);
  useEffect(() => {
    setNumPages(null);
  }, [data]);

  return (
    <Document
      className="pdf-document"
      file={{ data }}
      onLoadSuccess={({ numPages: total }) => setNumPages(total)}
      loading={<div className="page-surface pdf-placeholder">Loading PDF…</div>}
      error={<div className="page-surface pdf-placeholder">Unable to load PDF.</div>}
    >
      {numPages &&
        Array.from({ length: numPages }, (_, index) => (
          <Page
            className="page-surface pdf-page"
            key={`page-${index}`}
            pageNumber={index + 1}
            renderAnnotationLayer
            renderTextLayer
            width={PAGE_PREVIEW_WIDTH}
          />
        ))}
    </Document>
  );
}

async function appendMarkdownFragment(pdfDoc, content, heading, startPageNumber = 0) {
  const {
    topLeftFields,
    captionRightFields,
    plaintiffName,
    defendantName,
    caseNumber,
    courtName,
    documentTitle,
  } = heading;

  const safeTopLeft = topLeftFields.length ? topLeftFields : [''];
  const safeCaptionRight = captionRightFields.length ? captionRightFields : [''];
  const clean = removeMarkdown(content || '').trim();
  const normalizedPlaintiff = (plaintiffName || 'Plaintiff Name').toUpperCase();
  const normalizedDefendant = (defendantName || 'Defendant Name').toUpperCase();
  const normalizedTitle = (documentTitle || 'Document Title').toUpperCase();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const leftMargin = 72;
  const rightMargin = 36;
  const topMargin = 72;
  const bottomMargin = 72;
  const numbersGutter = 24;
  const bodyFontSize = 12;
  const titleFontSize = 14;
  const lineHeight = 18;
  const footerFontSize = 10;
  const maxWidth = LETTER_WIDTH - rightMargin - leftMargin;
  const numbersX = leftMargin - numbersGutter + 6;
  const bodyTextX = leftMargin;

  let page;
  let cursorY = LETTER_HEIGHT - topMargin;
  let pageCount = 0;
  let currentLineNumber = 1;

  const drawFooter = (targetPage, pageNumberLabel) => {
    const footerTitle = normalizedTitle;
    const footerY = bottomMargin / 2;
    targetPage.drawText(footerTitle, {
      x: leftMargin,
      y: footerY,
      size: footerFontSize,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    const pageLabel = `Page ${pageNumberLabel}`;
    const labelWidth = regularFont.widthOfTextAtSize(pageLabel, footerFontSize);
    targetPage.drawText(pageLabel, {
      x: LETTER_WIDTH - rightMargin - labelWidth,
      y: footerY,
      size: footerFontSize,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
  };

  const drawLineGuides = (targetPage) => {
    targetPage.drawLine({
      start: { x: leftMargin - numbersGutter, y: bottomMargin },
      end: { x: leftMargin - numbersGutter, y: LETTER_HEIGHT - bottomMargin },
      thickness: 1.2,
      color: rgb(0, 0, 0),
    });
    targetPage.drawLine({
      start: { x: leftMargin - numbersGutter / 2, y: bottomMargin },
      end: { x: leftMargin - numbersGutter / 2, y: LETTER_HEIGHT - bottomMargin },
      thickness: 0.8,
      color: rgb(0, 0, 0),
    });
  };

  const drawHeader = (targetPage) => {
    let headerCursor = LETTER_HEIGHT - topMargin;
    safeTopLeft.forEach((field) => {
      if (field) {
        targetPage.drawText(field, {
          x: leftMargin,
          y: headerCursor,
          size: bodyFontSize,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
      }
      headerCursor -= lineHeight;
    });

    headerCursor -= lineHeight / 2;

    const boxLeft = leftMargin - numbersGutter;
    const boxWidth = LETTER_WIDTH - boxLeft - rightMargin;
    const leftBoxWidth = 252;
    const captionLines = Math.max(safeCaptionRight.length + 1, 3);
    const boxHeight = lineHeight * captionLines + 24;
    const boxTop = headerCursor;
    const boxBottom = boxTop - boxHeight;

    targetPage.drawRectangle({
      x: boxLeft,
      y: boxBottom,
      width: boxWidth,
      height: boxHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1.4,
      color: rgb(1, 1, 1),
      opacity: 0,
    });

    targetPage.drawLine({
      start: { x: boxLeft + leftBoxWidth, y: boxBottom },
      end: { x: boxLeft + leftBoxWidth, y: boxTop },
      thickness: 1.2,
      color: rgb(0, 0, 0),
    });

    targetPage.drawLine({
      start: { x: boxLeft, y: boxBottom },
      end: { x: boxLeft + boxWidth, y: boxBottom },
      thickness: 2,
      color: rgb(0, 0, 0),
    });

    const leftTextX = boxLeft + 18;
    let leftTextY = boxTop - 18;
    targetPage.drawText(normalizedPlaintiff, {
      x: leftTextX,
      y: leftTextY,
      size: bodyFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    leftTextY -= lineHeight;
    targetPage.drawText('v.', {
      x: leftTextX,
      y: leftTextY,
      size: bodyFontSize,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    leftTextY -= lineHeight;
    targetPage.drawText(normalizedDefendant, {
      x: leftTextX,
      y: leftTextY,
      size: bodyFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    const rightTextX = boxLeft + leftBoxWidth + 18;
    let rightTextY = boxTop - 18;
    if (caseNumber) {
      targetPage.drawText(caseNumber, {
        x: rightTextX,
        y: rightTextY,
        size: bodyFontSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      rightTextY -= lineHeight;
    }
    safeCaptionRight.forEach((field) => {
      if (field) {
        targetPage.drawText(field, {
          x: rightTextX,
          y: rightTextY,
          size: bodyFontSize,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
      }
      rightTextY -= lineHeight;
    });

    const courtText = courtName || 'SUPERIOR COURT OF CALIFORNIA';
    const courtWidth = boldFont.widthOfTextAtSize(courtText, bodyFontSize);
    const courtX = (LETTER_WIDTH - courtWidth) / 2;
    const courtY = boxBottom - lineHeight;
    targetPage.drawText(courtText, {
      x: courtX,
      y: courtY,
      size: bodyFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    const titleText = normalizedTitle;
    const titleWidth = boldFont.widthOfTextAtSize(titleText, titleFontSize);
    const titleX = (LETTER_WIDTH - titleWidth) / 2;
    const titleY = courtY - lineHeight * 1.2;
    targetPage.drawText(titleText, {
      x: titleX,
      y: titleY,
      size: titleFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    return titleY - lineHeight * 1.2;
  };

  const startNewPage = (withHeader) => {
    page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
    pageCount += 1;
    currentLineNumber = 1;
    const pageNumberLabel = startPageNumber + pageCount;
    drawLineGuides(page);
    drawFooter(page, pageNumberLabel);
    cursorY = LETTER_HEIGHT - topMargin;
    if (withHeader) {
      cursorY = drawHeader(page);
    } else {
      cursorY -= lineHeight / 2;
    }
  };

  const ensureSpace = () => {
    if (cursorY <= bottomMargin + lineHeight) {
      startNewPage(false);
    }
  };

  const drawLineNumber = () => {
    const label = `${currentLineNumber}`;
    const labelWidth = regularFont.widthOfTextAtSize(label, footerFontSize);
    page.drawText(label, {
      x: numbersX - labelWidth / 2,
      y: cursorY,
      size: footerFontSize,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    currentLineNumber += 1;
  };

  const commitLine = (text) => {
    ensureSpace();
    drawLineNumber();
    if (text.trim()) {
      page.drawText(text.trim(), {
        x: bodyTextX,
        y: cursorY,
        size: bodyFontSize,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
    }
    cursorY -= lineHeight;
  };

  startNewPage(true);

  if (!clean) {
    return pageCount;
  }

  const paragraphs = clean.split(/\n+/);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (!paragraph.trim()) {
      commitLine('');
      return;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = '';

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const candidateWidth = regularFont.widthOfTextAtSize(candidate, bodyFontSize);
      if (candidateWidth > maxWidth) {
        commitLine(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    });

    if (currentLine) {
      commitLine(currentLine);
    }

    if (paragraphIndex < paragraphs.length - 1) {
      commitLine('');
    }
  });

  return pageCount;
}

async function appendPdfFragment(pdfDoc, data) {
  const sourceDoc = await PDFDocument.load(data);
  const copiedPages = await pdfDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
  copiedPages.forEach((page) => pdfDoc.addPage(page));
  return copiedPages.length;
}

function FragmentList({ fragments, onChangeContent, onMove, onRemove }) {
  return (
    <div className="fragment-list">
      {fragments.map((fragment, index) => (
        <div key={fragment.id} className="fragment-item">
          <div className="fragment-header">
            <span className="fragment-index">{index + 1}.</span>
            <span className="fragment-label">
              {fragment.type === 'markdown' ? 'Markdown' : fragment.name || 'PDF'}
            </span>
            <div className="fragment-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => onMove(index, -1)}
                disabled={index === 0}
              >
                ↑
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => onMove(index, 1)}
                disabled={index === fragments.length - 1}
              >
                ↓
              </button>
              <button type="button" className="ghost" onClick={() => onRemove(fragment.id)}>
                ✕
              </button>
            </div>
          </div>
          {fragment.type === 'markdown' ? (
            <textarea
              value={fragment.content}
              onChange={(event) => onChangeContent(fragment.id, event.target.value)}
              className="markdown-editor"
              rows={6}
            />
          ) : (
            <p className="pdf-summary">{fragment.name}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [markdownDraft, setMarkdownDraft] = useState('');
  const [fragments, setFragments] = useState(() => [
    {
      id: createFragmentId(),
      type: 'markdown',
      content:
        '# Welcome to the legal drafting preview\n\nUse the panel on the left to add Markdown notes or attach PDFs. Drag the order using the arrows to see how the combined packet will render when printed.',
    },
  ]);
  const [headingExpanded, setHeadingExpanded] = useState(true);
  const [heading, setHeading] = useState({
    topLeftFields: [
      'Jane Attorney (SBN 123456)',
      'Law Offices of Example & Co.',
      '123 Legal Way',
      'San Francisco, CA 94102',
      'Tel: (415) 555-1212',
      'Fax: (415) 555-3434',
      'Email: jane@example.com',
    ],
    captionRightFields: ['Hon. John Doe', 'Dept. 12', 'Hearing: TBD'],
    plaintiffName: 'PLAINTIFF NAME',
    defendantName: 'DEFENDANT NAME',
    caseNumber: 'Case No. 123456',
    courtName: 'SUPERIOR COURT OF CALIFORNIA, COUNTY OF LOS ANGELES',
    documentTitle: 'Memorandum of Points and Authorities',
  });

  const previewRef = useRef(null);
  const inputRef = useRef(null);

  const handleHeadingFieldChange = useCallback((key, index, value) => {
    setHeading((current) => {
      const nextFields = [...current[key]];
      nextFields[index] = value;
      return { ...current, [key]: nextFields };
    });
  }, []);

  const handleHeadingFieldAdd = useCallback((key) => {
    setHeading((current) => ({ ...current, [key]: [...current[key], ''] }));
  }, []);

  const handleHeadingFieldRemove = useCallback((key, index) => {
    setHeading((current) => {
      const nextFields = current[key].filter((_, fieldIndex) => fieldIndex !== index);
      return { ...current, [key]: nextFields.length ? nextFields : [''] };
    });
  }, []);

  const handleHeadingValueChange = useCallback((key, value) => {
    setHeading((current) => ({ ...current, [key]: value }));
  }, []);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    documentTitle: 'legal-drafting-preview',
  });

  const handleMarkdownSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (!markdownDraft.trim()) return;
      setFragments((current) => [
        ...current,
        { id: createFragmentId(), type: 'markdown', content: markdownDraft.trim() },
      ]);
      setMarkdownDraft('');
    },
    [markdownDraft],
  );

  const handlePdfUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setFragments((current) => [
      ...current,
      { id: createFragmentId(), type: 'pdf', data: buffer, name: file.name },
    ]);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const handleFragmentContentChange = useCallback((id, content) => {
    setFragments((current) =>
      current.map((fragment) => (fragment.id === id ? { ...fragment, content } : fragment)),
    );
  }, []);

  const handleMoveFragment = useCallback((index, delta) => {
    setFragments((current) => {
      const next = [...current];
      const targetIndex = index + delta;
      if (targetIndex < 0 || targetIndex >= next.length) return current;
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const handleRemoveFragment = useCallback((id) => {
    setFragments((current) => current.filter((fragment) => fragment.id !== id));
  }, []);

  const handleCompilePdf = useCallback(async () => {
    if (!fragments.length) return;
    const pdfDoc = await PDFDocument.create();
    let runningPage = 0;

    for (const fragment of fragments) {
      if (fragment.type === 'markdown') {
        const added = await appendMarkdownFragment(pdfDoc, fragment.content, heading, runningPage);
        runningPage += added;
      } else if (fragment.type === 'pdf') {
        const added = await appendPdfFragment(pdfDoc, fragment.data);
        runningPage += added;
      }
    }

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'combined.pdf';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [fragments, heading]);

  const previewFragments = useMemo(() => {
    let markdownPageCounter = 0;
    return fragments.map((fragment) => {
      if (fragment.type === 'markdown') {
        markdownPageCounter += 1;
        return (
          <MarkdownPreview
            key={fragment.id}
            content={fragment.content}
            heading={heading}
            pageNumber={markdownPageCounter}
          />
        );
      }
      return <PdfPreview key={fragment.id} data={fragment.data} />;
    });
  }, [fragments, heading]);

  return (
    <div className="app-shell">
      <aside className="editor-panel">
        <h1>Document Builder</h1>
        <p className="lead">
          Assemble Markdown notes and PDFs into a single, print-ready packet. Add new fragments
          below and fine-tune their order.
        </p>

        <div className="card heading-card">
          <div className="heading-card-header">
            <label>Heading details</label>
            <button
              type="button"
              className="ghost"
              onClick={() => setHeadingExpanded((value) => !value)}
            >
              {headingExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {headingExpanded && (
            <div className="heading-editor">
              <div className="dynamic-field-group">
                <label>Top left information</label>
                {heading.topLeftFields.map((value, index) => (
                  <div key={`top-left-${index}`} className="dynamic-field">
                    <input
                      type="text"
                      className="text-input"
                      value={value}
                      onChange={(event) =>
                        handleHeadingFieldChange('topLeftFields', index, event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleHeadingFieldRemove('topLeftFields', index)}
                      disabled={heading.topLeftFields.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleHeadingFieldAdd('topLeftFields')}
                >
                  Add field
                </button>
              </div>

              <div className="field-pair">
                <div className="card-input">
                  <label htmlFor="plaintiff">Plaintiff</label>
                  <input
                    id="plaintiff"
                    type="text"
                    className="text-input"
                    value={heading.plaintiffName}
                    onChange={(event) => handleHeadingValueChange('plaintiffName', event.target.value)}
                  />
                </div>
                <div className="card-input">
                  <label htmlFor="defendant">Defendant</label>
                  <input
                    id="defendant"
                    type="text"
                    className="text-input"
                    value={heading.defendantName}
                    onChange={(event) => handleHeadingValueChange('defendantName', event.target.value)}
                  />
                </div>
              </div>

              <div className="card-input">
                <label htmlFor="case-number">Case number</label>
                <input
                  id="case-number"
                  type="text"
                  className="text-input"
                  value={heading.caseNumber}
                  onChange={(event) => handleHeadingValueChange('caseNumber', event.target.value)}
                />
              </div>

              <div className="dynamic-field-group">
                <label>Caption right details</label>
                {heading.captionRightFields.map((value, index) => (
                  <div key={`caption-right-${index}`} className="dynamic-field">
                    <input
                      type="text"
                      className="text-input"
                      value={value}
                      onChange={(event) =>
                        handleHeadingFieldChange('captionRightFields', index, event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleHeadingFieldRemove('captionRightFields', index)}
                      disabled={heading.captionRightFields.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleHeadingFieldAdd('captionRightFields')}
                >
                  Add field
                </button>
              </div>

              <div className="card-input">
                <label htmlFor="court-name">Court name</label>
                <input
                  id="court-name"
                  type="text"
                  className="text-input"
                  value={heading.courtName}
                  onChange={(event) => handleHeadingValueChange('courtName', event.target.value)}
                />
              </div>

              <div className="card-input">
                <label htmlFor="document-title">Document title</label>
                <input
                  id="document-title"
                  type="text"
                  className="text-input"
                  value={heading.documentTitle}
                  onChange={(event) => handleHeadingValueChange('documentTitle', event.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleMarkdownSubmit} className="card">
          <label htmlFor="markdown-input">Markdown fragment</label>
          <textarea
            id="markdown-input"
            className="markdown-input"
            placeholder="## Title\n\nDraft your content here..."
            value={markdownDraft}
            onChange={(event) => setMarkdownDraft(event.target.value)}
            rows={8}
          />
          <button type="submit" className="primary">
            Add Markdown
          </button>
        </form>

        <div className="card">
          <label htmlFor="pdf-input">Attach PDF</label>
          <input
            id="pdf-input"
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
          />
          <p className="help-text">
            Uploaded PDFs keep their original pagination. Multi-page documents are supported.
          </p>
        </div>

        <FragmentList
          fragments={fragments}
          onChangeContent={handleFragmentContentChange}
          onMove={handleMoveFragment}
          onRemove={handleRemoveFragment}
        />
      </aside>

      <main className="preview-panel">
        <div className="toolbar">
          <button type="button" onClick={handlePrint} className="secondary">
            Print or Save as PDF
          </button>
          <button type="button" onClick={handleCompilePdf} className="primary">
            Download Combined PDF
          </button>
        </div>
        <div className="preview-scroll" ref={previewRef}>
          {previewFragments.length ? (
            previewFragments
          ) : (
            <div className="empty-state">
              <p>Add Markdown or upload a PDF to begin building your packet.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
