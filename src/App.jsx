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
const MARKDOWN_MARGIN = 56;
const PAGE_PREVIEW_WIDTH = Math.round(8.5 * 96);
const PLEADING_LINE_COUNT = 28;

function createFragmentId() {
  fragmentCounter += 1;
  return `fragment-${fragmentCounter}`;
}

function PleadingHeader({ header }) {
  const {
    leftFields,
    captionRightFields,
    plaintiff,
    defendant,
    documentTitle,
  } = header;

  const uppercaseTitle = (documentTitle || '').toUpperCase();

  return (
    <header className="pleading-header">
      <div className="pleading-header__top">
        <div className="pleading-header__left">
          {leftFields.length ? (
            leftFields.map((field, index) => (
              <div key={`left-field-${index}`} className="pleading-header__line">
                {field || '\u00A0'}
              </div>
            ))
          ) : (
            <div className="pleading-header__line">\u00A0</div>
          )}
        </div>
        <div className="pleading-header__right" aria-hidden="true" />
      </div>

      <div className="pleading-caption">
        <div className="pleading-caption__left">
          <div className="pleading-caption__party">
            <span className="pleading-caption__label">Plaintiff:</span>
            <span className="pleading-caption__value">{plaintiff || '\u00A0'}</span>
          </div>
          <div className="pleading-caption__versus">v.</div>
          <div className="pleading-caption__party">
            <span className="pleading-caption__label">Defendant:</span>
            <span className="pleading-caption__value">{defendant || '\u00A0'}</span>
          </div>
        </div>
        <div className="pleading-caption__right">
          {captionRightFields.length ? (
            captionRightFields.map((field, index) => (
              <div key={`right-field-${index}`} className="pleading-header__line">
                {field || '\u00A0'}
              </div>
            ))
          ) : (
            <div className="pleading-header__line">\u00A0</div>
          )}
        </div>
      </div>

      <div className="pleading-title">{uppercaseTitle || '\u00A0'}</div>
    </header>
  );
}

function MarkdownPreview({ content, header, pageNumber }) {
  const lineNumbers = useMemo(
    () => Array.from({ length: PLEADING_LINE_COUNT }, (_, index) => index + 1),
    [],
  );

  return (
    <div className="page-surface pleading-page">
      <PleadingHeader header={header} />

      <div className="pleading-body">
        <div className="pleading-line-numbers">
          {lineNumbers.map((line) => (
            <span key={`line-${line}`}>{line}</span>
          ))}
        </div>
        <div className="pleading-content markdown-fragment">
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

      <footer className="pleading-footer">
        <span className="pleading-footer__title">
          {(header.documentTitle || '').toUpperCase() || '\u00A0'}
        </span>
        <span className="pleading-footer__page">Page {pageNumber}</span>
      </footer>
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

async function appendMarkdownFragment(pdfDoc, content, header) {
  const clean = removeMarkdown(content || '');
  if (!clean.trim()) {
    return;
  }
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const lineColor = rgb(0, 0, 0);

  const bodyFontSize = 12;
  const bodyLineHeight = bodyFontSize * 1.5;
  const headerFontSize = 11;
  const headerLineHeight = 14;
  const titleFontSize = 14;
  const footerFontSize = 10;

  const topMargin = 72;
  const bottomMargin = 72;
  const leftMargin = 72;
  const rightMargin = 36;
  const lineNumberColumnWidth = 24;
  const guidelineOffset = 18;
  const contentX = leftMargin + lineNumberColumnWidth + 12;
  const maxWidth = LETTER_WIDTH - rightMargin - contentX;
  const lineNumberX = leftMargin - guidelineOffset;

  const leftFields = header?.leftFields || [];
  const captionRightFields = header?.captionRightFields || [];
  const plaintiff = header?.plaintiff || '';
  const defendant = header?.defendant || '';
  const documentTitle = header?.documentTitle || '';
  const uppercaseTitle = documentTitle.toUpperCase();

  const drawHeader = (page) => {
    let headerCursor = LETTER_HEIGHT - topMargin;

    if (leftFields.length) {
      leftFields.forEach((field) => {
        page.drawText(field || '', {
          x: leftMargin,
          y: headerCursor,
          size: headerFontSize,
          font,
          color: lineColor,
        });
        headerCursor -= headerLineHeight;
      });
    } else {
      headerCursor -= headerLineHeight;
    }

    headerCursor -= 8;

    const captionTop = headerCursor;
    const captionHeight = 132;
    const captionBottom = captionTop - captionHeight;
    const captionLeft = leftMargin;
    const captionRight = LETTER_WIDTH - rightMargin;

    page.drawLine({
      start: { x: captionRight, y: captionTop },
      end: { x: captionRight, y: captionBottom },
      thickness: 1,
      color: lineColor,
    });
    page.drawLine({
      start: { x: captionLeft, y: captionBottom },
      end: { x: captionRight, y: captionBottom },
      thickness: 1,
      color: lineColor,
    });

    let captionLeftCursor = captionTop - 26;
    const captionLeftX = captionLeft + 12;
    page.drawText(`Plaintiff: ${plaintiff}`.trim(), {
      x: captionLeftX,
      y: captionLeftCursor,
      size: bodyFontSize,
      font,
      color: lineColor,
    });
    captionLeftCursor -= bodyLineHeight;
    page.drawText('v.', {
      x: captionLeftX,
      y: captionLeftCursor,
      size: bodyFontSize,
      font,
      color: lineColor,
    });
    captionLeftCursor -= bodyLineHeight;
    page.drawText(`Defendant: ${defendant}`.trim(), {
      x: captionLeftX,
      y: captionLeftCursor,
      size: bodyFontSize,
      font,
      color: lineColor,
    });

    let captionRightCursor = captionTop - 26;
    const captionRightX = captionRight - 12;
    if (captionRightFields.length) {
      captionRightFields.forEach((field) => {
        const text = field || '';
        const fieldWidth = font.widthOfTextAtSize(text, bodyFontSize);
        page.drawText(text, {
          x: captionRightX - fieldWidth,
          y: captionRightCursor,
          size: bodyFontSize,
          font,
          color: lineColor,
        });
        captionRightCursor -= bodyLineHeight;
      });
    }

    const titleY = captionBottom - 32;
    if (uppercaseTitle) {
      const titleWidth = font.widthOfTextAtSize(uppercaseTitle, titleFontSize);
      const availableWidth = captionRight - captionLeft - 24;
      const titleX = captionLeft + 12 + Math.max(0, (availableWidth - titleWidth) / 2);
      page.drawText(uppercaseTitle, {
        x: titleX,
        y: titleY,
        size: titleFontSize,
        font,
        color: lineColor,
      });
    }

    page.drawLine({
      start: { x: leftMargin - guidelineOffset, y: LETTER_HEIGHT - topMargin },
      end: { x: leftMargin - guidelineOffset, y: bottomMargin },
      thickness: 1,
      color: lineColor,
    });
    page.drawLine({
      start: { x: LETTER_WIDTH - rightMargin + guidelineOffset, y: LETTER_HEIGHT - topMargin },
      end: { x: LETTER_WIDTH - rightMargin + guidelineOffset, y: bottomMargin },
      thickness: 1,
      color: lineColor,
    });

    return titleY - 24;
  };

  const createFooter = (page, pageNumber) => {
    const footerTitle = uppercaseTitle || 'DOCUMENT TITLE';
    const footerY = bottomMargin - 40;
    page.drawText(footerTitle, {
      x: leftMargin,
      y: footerY,
      size: footerFontSize,
      font,
      color: lineColor,
    });
    const label = `Page ${pageNumber}`;
    const labelWidth = font.widthOfTextAtSize(label, footerFontSize);
    page.drawText(label, {
      x: LETTER_WIDTH - rightMargin - labelWidth,
      y: footerY,
      size: footerFontSize,
      font,
      color: lineColor,
    });
  };

  let page = null;
  let cursorY = 0;
  let lineNumber = 1;

  const ensurePage = () => {
    if (!page || cursorY <= bottomMargin + bodyLineHeight || lineNumber > PLEADING_LINE_COUNT) {
      page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
      const pageNumber = pdfDoc.getPageCount();
      cursorY = drawHeader(page);
      createFooter(page, pageNumber);
      lineNumber = 1;
    }
  };

  const drawBodyLine = (text) => {
    ensurePage();
    page.drawText(String(lineNumber).padStart(2, ' '), {
      x: lineNumberX,
      y: cursorY,
      size: footerFontSize,
      font,
      color: lineColor,
    });
    if (text) {
      page.drawText(text, {
        x: contentX,
        y: cursorY,
        size: bodyFontSize,
        font,
        color: lineColor,
      });
    }
    cursorY -= bodyLineHeight;
    lineNumber += 1;
  };

  const paragraphs = clean.split(/\n+/);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      drawBodyLine('');
      return;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = '';

    const commitLine = () => {
      if (!currentLine.trim()) return;
      const text = currentLine.trim();
      drawBodyLine(text);
      currentLine = '';
    };

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, bodyFontSize);
      if (width > maxWidth) {
        commitLine();
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    });

    commitLine();

    if (paragraphIndex < paragraphs.length - 1) {
      drawBodyLine('');
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

function FieldListEditor({
  label,
  fields,
  onChangeField,
  onAddField,
  onRemoveField,
  addLabel,
}) {
  return (
    <div className="field-list-editor">
      <div className="field-list-editor__header">
        <span>{label}</span>
        <button type="button" className="ghost" onClick={onAddField}>
          + Add {addLabel}
        </button>
      </div>
      <div className="field-list-editor__items">
        {fields.map((value, index) => (
          <div key={`${label}-${index}`} className="field-list-editor__item">
            <input
              type="text"
              value={value}
              onChange={(event) => onChangeField(index, event.target.value)}
            />
            <button
              type="button"
              className="ghost"
              onClick={() => onRemoveField(index)}
              aria-label={`Remove ${addLabel} ${index + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [markdownDraft, setMarkdownDraft] = useState('');
  const [leftHeaderFields, setLeftHeaderFields] = useState([
    'Jane Q. Attorney (SBN 123456)',
    '1234 Main Street, Suite 500',
    'Los Angeles, CA 90012',
    'Tel: (555) 123-4567',
    'Email: attorney@example.com',
  ]);
  const [captionRightFields, setCaptionRightFields] = useState([
    'Hon. Alex Smith',
    'Dept. 30',
    'Case No.: TBD',
  ]);
  const [plaintiffName, setPlaintiffName] = useState('John Doe');
  const [defendantName, setDefendantName] = useState('Acme Corporation');
  const [documentTitle, setDocumentTitle] = useState('Notice of Motion and Motion');
  const [isHeadingEditorOpen, setHeadingEditorOpen] = useState(false);
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
    let pageCount = 1;
    try {
      const uploadedDoc = await PDFDocument.load(buffer);
      pageCount = uploadedDoc.getPageCount();
    } catch (error) {
      pageCount = 1;
    }
    setFragments((current) => [
      ...current,
      { id: createFragmentId(), type: 'pdf', data: buffer, name: file.name, pageCount },
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

  const headerConfig = useMemo(
    () => ({
      leftFields: leftHeaderFields,
      captionRightFields,
      plaintiff: plaintiffName,
      defendant: defendantName,
      documentTitle,
    }),
    [leftHeaderFields, captionRightFields, plaintiffName, defendantName, documentTitle],
  );

  const handleCompilePdf = useCallback(async () => {
    if (!fragments.length) return;
    const pdfDoc = await PDFDocument.create();

    for (const fragment of fragments) {
      if (fragment.type === 'markdown') {
        await appendMarkdownFragment(pdfDoc, fragment.content, headerConfig);
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
  }, [fragments, headerConfig]);

  const previewFragments = useMemo(() => {
    let runningPage = 1;

    return fragments.map((fragment) => {
      if (fragment.type === 'markdown') {
        const element = (
          <MarkdownPreview
            key={fragment.id}
            content={fragment.content}
            header={headerConfig}
            pageNumber={runningPage}
          />
        );
        runningPage += 1;
        return element;
      }

      runningPage += fragment.pageCount ?? 1;
      return <PdfPreview key={fragment.id} data={fragment.data} />;
    });
  }, [fragments, headerConfig]);

  return (
    <div className="app-shell">
      <aside className="editor-panel">
        <h1>Document Builder</h1>
        <p className="lead">
          Assemble Markdown notes and PDFs into a single, print-ready packet. Add new fragments
          below and fine-tune their order.
        </p>

        <div className="card">
          <div className="card-header">
            <h2>Pleading Header</h2>
            <button
              type="button"
              className="secondary"
              onClick={() => setHeadingEditorOpen((state) => !state)}
            >
              {isHeadingEditorOpen ? 'Hide' : 'Edit'} header
            </button>
          </div>

          {isHeadingEditorOpen && (
            <div className="heading-editor">
              <FieldListEditor
                label="Top left information"
                fields={leftHeaderFields}
                onChangeField={(index, value) =>
                  setLeftHeaderFields((current) =>
                    current.map((item, idx) => (idx === index ? value : item)),
                  )
                }
                onAddField={() => setLeftHeaderFields((current) => [...current, ''])}
                onRemoveField={(index) =>
                  setLeftHeaderFields((current) => current.filter((_, idx) => idx !== index))
                }
                addLabel="left field"
              />

              <div className="heading-editor__split">
                <div className="heading-editor__field">
                  <label htmlFor="plaintiff-input">Plaintiff name</label>
                  <input
                    id="plaintiff-input"
                    type="text"
                    value={plaintiffName}
                    onChange={(event) => setPlaintiffName(event.target.value)}
                  />
                </div>
                <div className="heading-editor__field">
                  <label htmlFor="defendant-input">Defendant name</label>
                  <input
                    id="defendant-input"
                    type="text"
                    value={defendantName}
                    onChange={(event) => setDefendantName(event.target.value)}
                  />
                </div>
              </div>

              <FieldListEditor
                label="Right caption information"
                fields={captionRightFields}
                onChangeField={(index, value) =>
                  setCaptionRightFields((current) =>
                    current.map((item, idx) => (idx === index ? value : item)),
                  )
                }
                onAddField={() => setCaptionRightFields((current) => [...current, ''])}
                onRemoveField={(index) =>
                  setCaptionRightFields((current) => current.filter((_, idx) => idx !== index))
                }
                addLabel="right field"
              />

              <div className="heading-editor__field">
                <label htmlFor="document-title-input">Document title</label>
                <input
                  id="document-title-input"
                  type="text"
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
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
