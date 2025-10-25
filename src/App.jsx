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
const LINE_NUMBER_COUNT = 28;

function createFragmentId() {
  fragmentCounter += 1;
  return `fragment-${fragmentCounter}`;
}

function MarkdownPreview({ content, headerConfig, pageNumber }) {
  const lineNumbers = useMemo(
    () => Array.from({ length: LINE_NUMBER_COUNT }, (_, index) => index + 1),
    [],
  );
  const {
    contactFields,
    captionRightFields,
    courtName,
    plaintiffName,
    defendantName,
    documentTitle,
  } = headerConfig;

  const displayTitle = documentTitle?.trim() ? documentTitle.trim() : 'Document Title';
  const uppercaseTitle = displayTitle.toUpperCase();
  const safeContactFields = contactFields.length ? contactFields : [''];
  const safeRightFields = captionRightFields.length ? captionRightFields : [''];

  return (
    <div className="page-surface pleading-page">
      <div className="pleading-line-numbers" aria-hidden="true">
        {lineNumbers.map((number) => (
          <span key={number}>{number}</span>
        ))}
      </div>
      <div className="pleading-paper">
        <header className="pleading-header">
          <div className="pleading-heading">
            <div className="pleading-heading-left">
              {safeContactFields.map((line, index) => (
                <div key={`contact-${index}`} className="pleading-heading-line">
                  {line || ' '}
                </div>
              ))}
            </div>
            <div className="pleading-heading-right" aria-hidden="true" />
          </div>
          <div className="pleading-caption">
            <div className="pleading-caption-left">
              <div className="pleading-court">{courtName || 'SUPERIOR COURT OF CALIFORNIA'}</div>
              <div className="pleading-parties">
                <span className="party-name">{plaintiffName || 'PLAINTIFF'}</span>
                <span className="party-versus">v.</span>
                <span className="party-name">{defendantName || 'DEFENDANT'}</span>
              </div>
            </div>
            <div className="pleading-caption-right">
              {safeRightFields.map((line, index) => (
                <div key={`right-${index}`} className="pleading-caption-line">
                  {line || ' '}
                </div>
              ))}
            </div>
          </div>
          <div className="pleading-document-title">{uppercaseTitle}</div>
        </header>
        <div className="pleading-body markdown-fragment">
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
        <footer className="pleading-footer">
          <span className="pleading-footer-title">{uppercaseTitle}</span>
          <span className="pleading-footer-page">Page {pageNumber}</span>
        </footer>
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

async function appendMarkdownFragment(pdfDoc, content) {
  const clean = removeMarkdown(content || '').trim();
  if (!clean) {
    return;
  }
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  let cursorY = LETTER_HEIGHT - MARKDOWN_MARGIN;

  const lines = clean.split(/\n+/);
  const lineHeight = 16;
  const fontSize = 12;
  const maxWidth = LETTER_WIDTH - MARKDOWN_MARGIN * 2;

  lines.forEach((line, index) => {
    if (!line.trim()) {
      cursorY -= lineHeight;
      if (cursorY <= MARKDOWN_MARGIN) {
        page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
        cursorY = LETTER_HEIGHT - MARKDOWN_MARGIN;
      }
      return;
    }

    const words = line.split(/\s+/);
    let currentLine = '';

    const commitLine = () => {
      if (!currentLine.trim()) return;
      if (cursorY <= MARKDOWN_MARGIN) {
        page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
        cursorY = LETTER_HEIGHT - MARKDOWN_MARGIN;
      }
      page.drawText(currentLine.trim(), {
        x: MARKDOWN_MARGIN,
        y: cursorY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      cursorY -= lineHeight;
      currentLine = '';
    };

    words.forEach((word) => {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(nextLine, fontSize);
      if (width > maxWidth) {
        commitLine();
        currentLine = word;
      } else {
        currentLine = nextLine;
      }
    });

    commitLine();

    if (index < lines.length - 1) {
      cursorY -= lineHeight * 0.5;
      if (cursorY <= MARKDOWN_MARGIN) {
        page = pdfDoc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
        cursorY = LETTER_HEIGHT - MARKDOWN_MARGIN;
      }
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
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [contactFields, setContactFields] = useState([
    'YOUR NAME (SBN 000000)',
    'Your Firm Name',
    '123 Legal Street',
    'City, State ZIP',
    'Telephone: (000) 000-0000',
    'Email: you@example.com',
  ]);
  const [plaintiffName, setPlaintiffName] = useState('PLAINTIFF NAME');
  const [defendantName, setDefendantName] = useState('DEFENDANT NAME');
  const [courtName, setCourtName] = useState('SUPERIOR COURT OF CALIFORNIA, COUNTY OF __________');
  const [captionRightFields, setCaptionRightFields] = useState([
    'Case No.: __________',
    'Assigned Judge: __________',
    'Dept.: ___',
  ]);
  const [documentTitle, setDocumentTitle] = useState('Notice of Motion and Motion');

  const previewRef = useRef(null);
  const inputRef = useRef(null);

  const headerConfig = useMemo(
    () => ({
      contactFields,
      captionRightFields,
      courtName,
      plaintiffName,
      defendantName,
      documentTitle,
    }),
    [contactFields, captionRightFields, courtName, plaintiffName, defendantName, documentTitle],
  );

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

  const handleContactFieldChange = useCallback((index, value) => {
    setContactFields((current) => current.map((line, lineIndex) => (lineIndex === index ? value : line)));
  }, []);

  const handleAddContactField = useCallback(() => {
    setContactFields((current) => [...current, '']);
  }, []);

  const handleRemoveContactField = useCallback((index) => {
    setContactFields((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }, []);

  const handleRightFieldChange = useCallback((index, value) => {
    setCaptionRightFields((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? value : line)),
    );
  }, []);

  const handleAddRightField = useCallback(() => {
    setCaptionRightFields((current) => [...current, '']);
  }, []);

  const handleRemoveRightField = useCallback((index) => {
    setCaptionRightFields((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }, []);

  const handleCompilePdf = useCallback(async () => {
    if (!fragments.length) return;
    const pdfDoc = await PDFDocument.create();

    for (const fragment of fragments) {
      if (fragment.type === 'markdown') {
        await appendMarkdownFragment(pdfDoc, fragment.content);
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
  }, [fragments]);

  const previewFragments = useMemo(() => {
    let markdownPageCounter = 0;
    return fragments.map((fragment) => {
      if (fragment.type === 'markdown') {
        markdownPageCounter += 1;
        return (
          <MarkdownPreview
            key={fragment.id}
            content={fragment.content}
            headerConfig={headerConfig}
            pageNumber={markdownPageCounter}
          />
        );
      }

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

        <div className={`card header-config ${headerExpanded ? 'expanded' : ''}`}>
          <button
            type="button"
            className="header-toggle"
            onClick={() => setHeaderExpanded((expanded) => !expanded)}
          >
            <span>Pleading header</span>
            <span aria-hidden="true">{headerExpanded ? '−' : '+'}</span>
          </button>
          {headerExpanded && (
            <div className="header-config-body">
              <div className="header-section">
                <div className="header-section-title">
                  <span>Contact / heading lines</span>
                  <button type="button" className="ghost small" onClick={handleAddContactField}>
                    Add line
                  </button>
                </div>
                <div className="header-field-list">
                  {contactFields.map((line, index) => (
                    <div className="header-field" key={`contact-editor-${index}`}>
                      <input
                        type="text"
                        value={line}
                        onChange={(event) =>
                          handleContactFieldChange(index, event.target.value)
                        }
                        placeholder="Enter heading line"
                      />
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => handleRemoveContactField(index)}
                        aria-label="Remove heading line"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {!contactFields.length && (
                    <p className="header-empty">No heading lines configured.</p>
                  )}
                </div>
              </div>

              <div className="header-section grid">
                <label className="header-label" htmlFor="plaintiff-input">
                  Plaintiff name
                </label>
                <input
                  id="plaintiff-input"
                  type="text"
                  value={plaintiffName}
                  onChange={(event) => setPlaintiffName(event.target.value)}
                />

                <label className="header-label" htmlFor="defendant-input">
                  Defendant name
                </label>
                <input
                  id="defendant-input"
                  type="text"
                  value={defendantName}
                  onChange={(event) => setDefendantName(event.target.value)}
                />

                <label className="header-label" htmlFor="court-input">
                  Court name / venue line
                </label>
                <input
                  id="court-input"
                  type="text"
                  value={courtName}
                  onChange={(event) => setCourtName(event.target.value)}
                />
              </div>

              <div className="header-section">
                <div className="header-section-title">
                  <span>Right column details</span>
                  <button type="button" className="ghost small" onClick={handleAddRightField}>
                    Add line
                  </button>
                </div>
                <div className="header-field-list">
                  {captionRightFields.map((line, index) => (
                    <div className="header-field" key={`right-editor-${index}`}>
                      <input
                        type="text"
                        value={line}
                        onChange={(event) => handleRightFieldChange(index, event.target.value)}
                        placeholder="Enter right column detail"
                      />
                      <button
                        type="button"
                        className="ghost small"
                        onClick={() => handleRemoveRightField(index)}
                        aria-label="Remove right column line"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {!captionRightFields.length && (
                    <p className="header-empty">No right column details configured.</p>
                  )}
                </div>
              </div>

              <div className="header-section grid">
                <label className="header-label" htmlFor="document-title-input">
                  Document title
                </label>
                <input
                  id="document-title-input"
                  type="text"
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  placeholder="Document title"
                />
                <p className="header-hint">Rendered in bold, uppercase in the header.</p>
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
