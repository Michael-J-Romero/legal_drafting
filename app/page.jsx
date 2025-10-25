'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Document, Page, pdfjs } from 'react-pdf/dist/esm/entry.webpack.js';
import { useReactToPrint } from 'react-to-print';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import removeMarkdown from 'remove-markdown';

let fragmentCounter = 0;

const LETTER_WIDTH = 612; // 8.5in * 72
const LETTER_HEIGHT = 792; // 11in * 72
const PAGE_PREVIEW_WIDTH = Math.round(8.5 * 96);
const PLEADING_LEFT_MARGIN = 72;
const PLEADING_RIGHT_MARGIN = 36;
const PLEADING_TOP_MARGIN = 72;
const PLEADING_BOTTOM_MARGIN = 72;
const PLEADING_NUMBER_GUTTER = 28;
const PLEADING_LINE_COUNT = 28;
const PLEADING_BODY_LINE_HEIGHT =
  (LETTER_HEIGHT - PLEADING_TOP_MARGIN - PLEADING_BOTTOM_MARGIN) / PLEADING_LINE_COUNT;

function createFragmentId() {
  fragmentCounter += 1;
  return `fragment-${fragmentCounter}`;
}

function MarkdownPreview({ content, heading }) {
  const {
    leftFields = [],
    rightFields = [],
    plaintiffName = '',
    defendantName = '',
    documentTitle = '',
  } = heading || {};

  const normalizedLeft = leftFields.filter((value) => value.trim());
  const normalizedRight = rightFields.filter((value) => value.trim());
  const upperTitle = documentTitle.trim().toUpperCase();

  return (
    <div className="page-surface markdown-fragment">
      <div className="pleading-paper">
        <div className="pleading-line-column" aria-hidden>
          {Array.from({ length: PLEADING_LINE_COUNT }, (_, index) => (
            <span key={`line-${index}`}>{index + 1}</span>
          ))}
        </div>
        <div className="pleading-main">
          <header className="pleading-header">
            <div className="pleading-contact">
              {normalizedLeft.length ? (
                normalizedLeft.map((value, index) => (
                  <div key={`left-field-${index}`} className="pleading-contact-line">
                    {value}
                  </div>
                ))
              ) : (
                <div className="pleading-contact-line pleading-placeholder">Attorney or party information</div>
              )}
            </div>
            <div className="pleading-clerk-space" aria-hidden />
          </header>

          <div className="pleading-caption">
            <div className="pleading-caption-left">
              <div className="pleading-caption-box">
                <div className="pleading-party-block">
                  <span className="pleading-party-label">Plaintiff:</span>
                  <span className="pleading-party-value">{plaintiffName || 'Plaintiff Name'}</span>
                </div>
                <div className="pleading-versus">v.</div>
                <div className="pleading-party-block">
                  <span className="pleading-party-label">Defendant:</span>
                  <span className="pleading-party-value">{defendantName || 'Defendant Name'}</span>
                </div>
              </div>
            </div>
            <div className="pleading-caption-right">
              {normalizedRight.length ? (
                normalizedRight.map((value, index) => (
                  <div key={`right-field-${index}`} className="pleading-right-line">
                    {value}
                  </div>
                ))
              ) : (
                <div className="pleading-right-line pleading-placeholder">
                  Court, judge, department details
                </div>
              )}
            </div>
          </div>

          <div className="pleading-document-title">
            {upperTitle || 'DOCUMENT TITLE'}
          </div>

          <div className="pleading-body">
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

async function appendMarkdownFragment(pdfDoc, content, heading) {
  const clean = removeMarkdown(content || '').trim();
  const {
    leftFields = [],
    rightFields = [],
    plaintiffName = '',
    defendantName = '',
    documentTitle = '',
  } = heading || {};

  const trimmedLeft = leftFields.filter((value) => value.trim());
  const trimmedRight = rightFields.filter((value) => value.trim());
  const hasHeadingContent =
    trimmedLeft.length ||
    trimmedRight.length ||
    plaintiffName.trim() ||
    defendantName.trim() ||
    documentTitle.trim();

  if (!clean && !hasHeadingContent) {
    return;
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const textLeftX = PLEADING_LEFT_MARGIN + PLEADING_NUMBER_GUTTER;
  const textRightLimit = LETTER_WIDTH - PLEADING_RIGHT_MARGIN;
  const maxWidth = textRightLimit - textLeftX;
  const headerLineHeight = 14;
  const uppercaseTitle = documentTitle.trim().toUpperCase();

  const drawLineNumbers = (page) => {
    const top = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
    for (let index = 0; index < PLEADING_LINE_COUNT; index += 1) {
      const y = top - index * PLEADING_BODY_LINE_HEIGHT;
      page.drawText(`${index + 1}`.padStart(2, ' '), {
        x: PLEADING_LEFT_MARGIN - 26,
        y,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });
    }
    page.drawLine({
      start: { x: PLEADING_LEFT_MARGIN - 6, y: top },
      end: { x: PLEADING_LEFT_MARGIN - 6, y: PLEADING_BOTTOM_MARGIN },
      thickness: 1.2,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: textRightLimit, y: top },
      end: { x: textRightLimit, y: PLEADING_BOTTOM_MARGIN },
      thickness: 0.8,
      color: rgb(0, 0, 0),
    });
  };

  const preparePage = () => {
    const page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
    drawLineNumbers(page);
    return page;
  };

  const drawHeading = (page) => {
    let cursorY = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
    const headerLines = Math.max(trimmedLeft.length, 7);

    trimmedLeft.forEach((value, index) => {
      const y = cursorY - index * headerLineHeight;
      page.drawText(value, {
        x: textLeftX,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    });

    cursorY -= headerLines * headerLineHeight + headerLineHeight;

    const captionHeight = headerLineHeight * 4;
    const captionTop = cursorY;
    const captionBottom = captionTop - captionHeight;
    const captionWidth = Math.min(240, maxWidth * 0.45);
    const captionX = textLeftX;

    page.drawRectangle({
      x: captionX,
      y: captionBottom,
      width: captionWidth,
      height: captionHeight,
      borderWidth: 1,
      borderColor: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: captionX + captionWidth, y: captionBottom },
      end: { x: captionX + captionWidth, y: captionTop },
      thickness: 2,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: captionX, y: captionBottom },
      end: { x: captionX + captionWidth, y: captionBottom },
      thickness: 2,
      color: rgb(0, 0, 0),
    });

    let partyY = captionTop - headerLineHeight * 1.2;
    const partyLabelSize = 10;
    const partyValueSize = 12;

    page.drawText('Plaintiff:', {
      x: captionX + 8,
      y: partyY,
      size: partyLabelSize,
      font,
    });
    const plaintiffValue = plaintiffName.trim() || '____________________________';
    page.drawText(plaintiffValue, {
      x: captionX + 80,
      y: partyY,
      size: partyValueSize,
      font: boldFont,
    });

    partyY -= headerLineHeight * 1.1;

    page.drawText('v.', {
      x: captionX + captionWidth / 2 - 6,
      y: partyY,
      size: partyValueSize,
      font: boldFont,
    });

    partyY -= headerLineHeight * 1.1;

    page.drawText('Defendant:', {
      x: captionX + 8,
      y: partyY,
      size: partyLabelSize,
      font,
    });
    const defendantValue = defendantName.trim() || '____________________________';
    page.drawText(defendantValue, {
      x: captionX + 80,
      y: partyY,
      size: partyValueSize,
      font: boldFont,
    });

    const rightColumnX = captionX + captionWidth + 24;
    let rightCursor = captionTop - headerLineHeight;
    trimmedRight.forEach((value) => {
      page.drawText(value, {
        x: rightColumnX,
        y: rightCursor,
        size: 11,
        font,
      });
      rightCursor -= headerLineHeight;
    });

    if (!trimmedRight.length) {
      page.drawText('Court, judge, department details', {
        x: rightColumnX,
        y: rightCursor,
        size: 11,
        font,
        color: rgb(0.45, 0.45, 0.45),
      });
      rightCursor -= headerLineHeight;
    }

    cursorY = captionBottom - headerLineHeight * 1.5;

    if (uppercaseTitle) {
      page.drawText(uppercaseTitle, {
        x: captionX,
        y: cursorY,
        size: 14,
        font: boldFont,
      });
      cursorY -= headerLineHeight * 2;
    } else {
      page.drawText('DOCUMENT TITLE', {
        x: captionX,
        y: cursorY,
        size: 14,
        font: boldFont,
        color: rgb(0.45, 0.45, 0.45),
      });
      cursorY -= headerLineHeight * 2;
    }

    return cursorY;
  };

  let page = preparePage();
  let cursorY = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
  let headingDrawn = false;

  if (hasHeadingContent) {
    cursorY = drawHeading(page);
    headingDrawn = true;
  }

  const lines = clean ? clean.split(/\n+/) : [];

  const commitLine = (line) => {
    if (!line.trim()) {
      cursorY -= PLEADING_BODY_LINE_HEIGHT;
      return;
    }

    const words = line.split(/\s+/);
    let current = '';

    const flush = () => {
      if (!current.trim()) return;
      if (cursorY <= PLEADING_BOTTOM_MARGIN) {
        page = preparePage();
        cursorY = LETTER_HEIGHT - PLEADING_TOP_MARGIN;
        if (hasHeadingContent && !headingDrawn) {
          cursorY = drawHeading(page);
          headingDrawn = true;
        }
      }
      page.drawText(current.trim(), {
        x: textLeftX,
        y: cursorY,
        size: 12,
        font,
      });
      cursorY -= PLEADING_BODY_LINE_HEIGHT;
      current = '';
    };

    words.forEach((word) => {
      const attempt = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(attempt, 12);
      if (width > maxWidth) {
        flush();
        current = word;
      } else {
        current = attempt;
      }
    });

    flush();
  };

  lines.forEach((line, index) => {
    commitLine(line);
    if (index < lines.length - 1) {
      cursorY -= PLEADING_BODY_LINE_HEIGHT * 0.5;
    }
  });
}

async function appendPdfFragment(pdfDoc, data) {
  const sourceDoc = await PDFDocument.load(data);
  const copiedPages = await pdfDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
  copiedPages.forEach((page) => pdfDoc.addPage(page));
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
                Remove
              </button>
            </div>
          </div>
          {fragment.type === 'markdown' && (
            <textarea
              className="markdown-editor"
              value={fragment.content}
              onChange={(event) => onChangeContent(fragment.id, event.target.value)}
              rows={6}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function HeadingFieldList({ label, fields, onAdd, onRemove, onChange }) {
  return (
    <div className="heading-field-section">
      <div className="heading-section-header">
        <span>{label}</span>
        <button type="button" className="ghost" onClick={onAdd}>
          Add line
        </button>
      </div>
      {fields.map((value, index) => (
        <div key={`${label}-${index}`} className="heading-field-row">
          <input
            type="text"
            className="heading-input"
            value={value}
            onChange={(event) => onChange(index, event.target.value)}
          />
          <button
            type="button"
            className="ghost"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${label} line ${index + 1}`}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [leftHeadingFields, setLeftHeadingFields] = useState([
    'Law Offices of Jane Smith',
    '123 Legal Avenue',
    'Suite 400',
    'Los Angeles, CA 90017',
    'Tel: (555) 123-4567',
    'Email: attorney@example.com',
  ]);
  const [rightHeadingFields, setRightHeadingFields] = useState([
    'SUPERIOR COURT OF CALIFORNIA',
    'COUNTY OF LOS ANGELES',
    'Case No.: __________',
    'Hon. ____________________',
    'Dept.: ___',
  ]);
  const [plaintiffName, setPlaintiffName] = useState('John Doe');
  const [defendantName, setDefendantName] = useState('Acme Corporation');
  const [documentTitle, setDocumentTitle] = useState('Notice of Motion and Motion');
  const [headingExpanded, setHeadingExpanded] = useState(true);
  const [markdownDraft, setMarkdownDraft] = useState('');
  const [fragments, setFragments] = useState(() => [
    {
      id: createFragmentId(),
      type: 'markdown',
      content:
        '# Welcome to the legal drafting preview\n\nUse the panel on the left to add Markdown notes or attach PDFs. Drag the order using the arrows to see how the combined packet will render when printed.',
    },
  ]);

  const previewRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  }, []);

  const headingSettings = useMemo(
    () => ({
      leftFields: leftHeadingFields,
      rightFields: rightHeadingFields,
      plaintiffName,
      defendantName,
      documentTitle,
    }),
    [leftHeadingFields, rightHeadingFields, plaintiffName, defendantName, documentTitle],
  );

  const handleAddLeftField = useCallback(() => {
    setLeftHeadingFields((current) => [...current, '']);
  }, []);

  const handleLeftFieldChange = useCallback((index, value) => {
    setLeftHeadingFields((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }, []);

  const handleRemoveLeftField = useCallback((index) => {
    setLeftHeadingFields((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const handleAddRightField = useCallback(() => {
    setRightHeadingFields((current) => [...current, '']);
  }, []);

  const handleRightFieldChange = useCallback((index, value) => {
    setRightHeadingFields((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }, []);

  const handleRemoveRightField = useCallback((index) => {
    setRightHeadingFields((current) => current.filter((_, itemIndex) => itemIndex !== index));
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

    for (const fragment of fragments) {
      if (fragment.type === 'markdown') {
        await appendMarkdownFragment(pdfDoc, fragment.content, headingSettings);
      } else if (fragment.type === 'pdf') {
        await appendPdfFragment(pdfDoc, fragment.data);
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
  }, [fragments, headingSettings]);

  const previewFragments = useMemo(
    () =>
      fragments.map((fragment) => (
        <Fragment key={fragment.id}>
          {fragment.type === 'markdown' ? (
            <MarkdownPreview content={fragment.content} heading={headingSettings} />
          ) : (
            <PdfPreview data={fragment.data} />
          )}
        </Fragment>
      )),
    [fragments, headingSettings],
  );

  return (
    <div className="app-shell">
      <aside className="editor-panel">
        <h1>Document Builder</h1>
        <p className="lead">
          Assemble Markdown notes and PDFs into a single, print-ready packet. Add new fragments below
          and fine-tune their order.
        </p>

        <div className={`card heading-card${headingExpanded ? ' expanded' : ''}`}>
          <button
            type="button"
            className="heading-toggle"
            onClick={() => setHeadingExpanded((current) => !current)}
            aria-expanded={headingExpanded}
          >
            <span>Pleading heading</span>
            <span className="heading-toggle-icon">{headingExpanded ? '−' : '+'}</span>
          </button>
          {headingExpanded && (
            <div className="heading-editor">
              <HeadingFieldList
                label="Left-side contact lines"
                fields={leftHeadingFields}
                onAdd={handleAddLeftField}
                onRemove={handleRemoveLeftField}
                onChange={handleLeftFieldChange}
              />

              <div className="heading-party-grid">
                <div className="heading-party-field">
                  <label className="heading-label" htmlFor="plaintiff-input">
                    Plaintiff name
                  </label>
                  <input
                    id="plaintiff-input"
                    type="text"
                    value={plaintiffName}
                    onChange={(event) => setPlaintiffName(event.target.value)}
                    className="heading-input"
                  />
                </div>
                <div className="heading-party-field">
                  <label className="heading-label" htmlFor="defendant-input">
                    Defendant name
                  </label>
                  <input
                    id="defendant-input"
                    type="text"
                    value={defendantName}
                    onChange={(event) => setDefendantName(event.target.value)}
                    className="heading-input"
                  />
                </div>
              </div>

              <HeadingFieldList
                label="Right-side caption details"
                fields={rightHeadingFields}
                onAdd={handleAddRightField}
                onRemove={handleRemoveRightField}
                onChange={handleRightFieldChange}
              />

              <label className="heading-label" htmlFor="document-title-input">
                Document title
              </label>
              <input
                id="document-title-input"
                type="text"
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                className="heading-input heading-title-input"
                placeholder="e.g., Memorandum of Points and Authorities"
              />
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
