'use client';

import React, { useEffect, useMemo, useState } from 'react';
import PdfPreview from './PdfPreview';
// No longer needed for undo/redo hydration
import PaginatedMarkdown from './PaginatedMarkdown';
import FullscreenOverlay from './FullscreenOverlay';
import { idbGetPdf } from '../lib/pdfStorage';
import { loadPdfjs } from '../lib/pdfjsLoader';
import { groupExhibits, buildIndexEntries, flattenImageExhibitsWithLabels, flattenPdfExhibitsWithLabels } from '../lib/exhibits';

export default function PreviewPanel({
  fragments,
  headingSettings,
  docDate,
  onPrint,
  onCompilePdf,
  onClearAll,
  onExportBundle,
  onImportBundle,
  getRawJson,
  onApplyRawJson,
  fullscreenFragmentId,
  setFullscreenFragmentId,
  contentRef,
}) {
  const [rawOpen, setRawOpen] = React.useState(false);
  const [rawText, setRawText] = React.useState('');
  const [rawError, setRawError] = React.useState('');


  // Decode base64 PDF data for PdfPreview
  function base64ToArrayBuffer(base64) {
    if (!base64 || typeof base64 !== 'string' || base64.length === 0) return null;
    try {
      const binary = window.atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (e) {
      // Invalid base64 string
      return null;
    }
  }

  function PdfByRef({ fileId, dataBase64, pageOffset = 0, totalPages }) {
    const [bytes, setBytes] = useState(null);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        if (dataBase64) {
          const buf = base64ToArrayBuffer(dataBase64);
          if (!cancelled) setBytes(buf);
          return;
        }
        if (fileId) {
          const data = await idbGetPdf(fileId);
          if (!cancelled) setBytes(data);
        }
      })();
      return () => { cancelled = true; };
    }, [fileId, dataBase64]);
    return bytes ? <PdfPreview data={bytes} pageOffset={pageOffset} totalPages={totalPages} /> : null;
  }

  function ExhibitTextPage({ captions = [], content = '', pageNumber, totalPages, title = '', coverCentered = false }) {
    // Avoid wrapping PaginatedMarkdown in a .pdf-page to prevent duplicate page-breaks in print.
    // For cover pages, render a single Pleading-style page with a centered overlay.
    if (coverCentered) {
      return (
        <div className="page-wrapper">
          <div className="page-surface markdown-fragment">
            <div className="pleading-paper" style={{ position: 'relative' }}>
              <div className="pleading-line-column" aria-hidden>
                {Array.from({ length: 28 }, (_, index) => (
                  <span key={`line-${index}`}>{index + 1}</span>
                ))}
              </div>
              <div className="pleading-main" style={{ position: 'relative' }}>
                {/* Optional caption stack above the centered title */}
                {Array.isArray(captions) && captions.filter(Boolean).length > 0 && (
                  <div >
                    {captions.filter(Boolean).map((line, idx) => (
                      <div key={`ex-cover-cap-${idx}`} style={{ fontWeight: 'bold' }}>{line}</div>
                    ))}
                  </div>
                )}
                {/* Minimal header spacing intentionally omitted for exhibit covers */}
                <div className="pleading-body" />
                {/* Centered overlay content */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    {title ? (
                      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16, textTransform: 'uppercase' }}>{title}</div>
                    ) : null}
                    {content ? (
                      <div style={{ fontSize: '12pt', whiteSpace: 'pre-wrap' }}>{content}</div>
                    ) : null}
                  </div>
                </div>
              </div>
              {/* Footer page number to match pleading pages (anchor to .pleading-paper for consistent position) */}
              {typeof pageNumber === 'number' && typeof totalPages === 'number' && (
                <div className="page-footer" aria-hidden>
                  <span>Page {pageNumber} of {totalPages}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <PaginatedMarkdown
        content={content || ''}
        heading={{}}
        title={title}
        docDate={docDate}
        pageOffset={pageNumber ? (pageNumber - 1) : 0}
        totalOverride={totalPages}
        hideHeader
        preTitleCaptions={(captions || []).filter(Boolean)}
        suppressTitlePlaceholder={false}
        disableSignature
      />
    );
  }

  function ImageByRef({ fileId, dataBase64, mimeType, alt, pageNumber, totalPages }) {
    const [url, setUrl] = useState(null);
    const canvasRef = React.useRef(null);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        if (dataBase64) {
          const url = `data:${mimeType || 'image/*'};base64,${dataBase64}`;
          if (!cancelled) setUrl(url);
          return;
        }
        if (fileId) {
          const data = await idbGetPdf(fileId);
          if (cancelled || !data) return;
          try {
            const blob = new Blob([data], { type: mimeType || 'application/octet-stream' });
            // Convert to data URL for reliable print/Save as PDF rendering
            const reader = new FileReader();
            reader.onload = () => { if (!cancelled) setUrl(reader.result); };
            reader.readAsDataURL(blob);
          } catch (_) {
            // ignore
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fileId, dataBase64, mimeType]);

    useEffect(() => {
      if (!url || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      let cancelled = false;
      img.onload = () => {
        if (cancelled) return;
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
        const CSS_PX_PER_IN = 96;
        const pageW = 8.5 * CSS_PX_PER_IN;
        const pageH = 11 * CSS_PX_PER_IN;
        const margin = 1 * CSS_PX_PER_IN;
        const maxW = pageW - 2 * margin;
        const maxH = pageH - 2 * margin;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const x = margin + (maxW - drawW) / 2;
        const y = margin + (maxH - drawH) / 2;

        canvas.width = Math.floor(pageW * dpr);
        canvas.height = Math.floor(pageH * dpr);
        canvas.style.width = '8.5in';
        canvas.style.height = '11in';
        ctx.reset && ctx.reset();
        if (dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x, y, drawW, drawH);

        // No description on image page per requirements
      };
      img.onerror = () => { /* ignore */ };
      img.src = url;
      return () => { cancelled = true; };
    }, [url]);
    if (!url) return null;
    return (
      <div className="pdf-page" style={{ background: '#fff', position: 'relative' }}>
        <div style={{ width: '8.5in', height: '11in', position: 'relative', background: '#fff' }}>
          <canvas ref={canvasRef} aria-label={alt || 'Exhibit'} />
          {(typeof pageNumber === 'number' && typeof totalPages === 'number') ? (
            <div className="page-footer" aria-hidden>
              <span>Page {pageNumber} of {totalPages}</span>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Track PDF page counts for exhibits so totals and offsets include PDF pages
  const [pdfCounts, setPdfCounts] = useState({}); // key -> numPages
  const [mdCounts, setMdCounts] = useState({}); // fragmentId -> numPages

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // collect all exhibit PDFs
        const keys = [];
        const tasks = [];
        const enqueue = (key, getBytes) => {
          if (!key) return;
          if (pdfCounts[key]) return;
          keys.push(key);
          tasks.push((async () => {
            let bytes = null;
            try { bytes = await getBytes(); } catch (_) {}
            if (!bytes) return { key, count: 0 };
            const pdfjs = await loadPdfjs();
            if (!pdfjs || !pdfjs.getDocument) return { key, count: 0 };
            const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true }).promise;
            return { key, count: doc.numPages || 0 };
          })());
        };
        fragments.forEach((fragment) => {
          if (fragment.type === 'pdf') {
            const key = fragment.fileId || (fragment.data ? `data:${(fragment.data || '').slice(0,64)}` : null);
            enqueue(key, async () => fragment.data ? base64ToArrayBuffer(fragment.data) : (fragment.fileId ? await idbGetPdf(fragment.fileId) : null));
            return;
          }
          if (fragment.type !== 'exhibits') return;
          const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
          const { groups } = groupExhibits(exhibits);
          const pdfItems = flattenPdfExhibitsWithLabels(groups);
          pdfItems.forEach(({ exhibit }) => {
            const key = exhibit.fileId || (exhibit.data ? `data:${(exhibit.data || '').slice(0,64)}` : null);
            enqueue(key, async () => exhibit.data ? base64ToArrayBuffer(exhibit.data) : (exhibit.fileId ? await idbGetPdf(exhibit.fileId) : null));
          });
        });
        if (!tasks.length) return;
        const results = await Promise.all(tasks);
        if (cancelled) return;
        setPdfCounts((prev) => {
          const next = { ...prev };
          results.forEach((r) => {
            if (!r) return;
            const { key, count } = r;
            if (key && count && !next[key]) next[key] = count;
          });
          return next;
        });
      } catch (_) {
        // ignore count errors
      }
    })();
    return () => { cancelled = true; };
  }, [fragments]);

  // Compute global total pages across all fragments with best-known counts
  const globalTotalPages = useMemo(() => {
    let total = 0;
    fragments.forEach((fragment) => {
      if (fragment.type === 'markdown') {
        const count = mdCounts[fragment.id] || 1;
        total += count;
      } else if (fragment.type === 'pdf') {
        const key = fragment.fileId || (fragment.data ? `data:${(fragment.data || '').slice(0,64)}` : null);
        const count = (key && pdfCounts[key]) ? pdfCounts[key] : 1;
        total += count;
      } else if (fragment.type === 'exhibits') {
        const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
        const { groups } = groupExhibits(exhibits);
        const imageItems = flattenImageExhibitsWithLabels(groups);
        total += (imageItems.length * 2) + 1; // image pairs + index
        const pdfItems = flattenPdfExhibitsWithLabels(groups);
        pdfItems.forEach(({ exhibit }) => {
          const key = exhibit.fileId || (exhibit.data ? `data:${(exhibit.data || '').slice(0,64)}` : null);
          const count = (key && pdfCounts[key]) ? pdfCounts[key] : 1;
          total += (1 + count); // cover + pdf pages
        });
      }
    });
    return Math.max(total, 1);
  }, [fragments, mdCounts, pdfCounts]);

  const previewFragments = useMemo(() => {
    const items = [];
    let cursor = 0; // 0-based page offset across the entire document
    fragments.forEach((fragment) => {
      if (fragment.type === 'markdown') {
        const mdCount = mdCounts[fragment.id] || 1;
        items.push(
          <React.Fragment key={fragment.id}>
            <div className="fragment-wrapper">
              <div className="fragment-toolbar">
                <button
                  type="button"
                  className="ghost"
                  title="Fullscreen"
                  onClick={() => setFullscreenFragmentId && setFullscreenFragmentId(fragment.id)}
                >
                  ⤢ Fullscreen
                </button>
              </div>
              <PaginatedMarkdown
                content={fragment.content}
                heading={headingSettings}
                title={fragment.title}
                docDate={docDate}
                pageOffset={cursor}
                totalOverride={globalTotalPages}
                onPageCount={(n) => setMdCounts((prev) => (prev[fragment.id] === n ? prev : { ...prev, [fragment.id]: n }))}
              />
            </div>
          </React.Fragment>
        );
        cursor += mdCount;
      } else if (fragment.type === 'pdf') {
        const key = fragment.fileId || (fragment.data ? `data:${(fragment.data || '').slice(0,64)}` : null);
        const pdfCount = (key && pdfCounts[key]) ? pdfCounts[key] : 1;
        items.push(
          <React.Fragment key={fragment.id}>
            <PdfByRef fileId={fragment.fileId} dataBase64={fragment.data} pageOffset={cursor} totalPages={globalTotalPages} />
          </React.Fragment>
        );
        cursor += pdfCount;
      } else if (fragment.type === 'exhibits') {
        const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
        const { groups } = groupExhibits(exhibits);

        // Compute starting page number for each exhibit label based on the render order below
        const imageItems = flattenImageExhibitsWithLabels(groups);
        const pdfItems = flattenPdfExhibitsWithLabels(groups);
        const labelStartPage = {}; // e.g., { 'A': 5, 'A1': 7 }
        let simCursor = cursor + 1; // first page after the index page
        // Images render first: each image exhibit = cover (1) + image page (1)
        imageItems.forEach(({ label }) => {
          labelStartPage[label] = simCursor; // cover page is the start of the exhibit
          simCursor += 2;
        });
        // PDF exhibits render after images: each = cover (1) + pdf page count (>=1)
        pdfItems.forEach(({ label, exhibit }) => {
          const key = exhibit.fileId || (exhibit.data ? `data:${(exhibit.data || '').slice(0,64)}` : null);
          const count = (key && pdfCounts[key]) ? pdfCounts[key] : 1; // unknown counts default to 1
          labelStartPage[label] = simCursor; // cover page is the start
          simCursor += 1 + count;
        });

        // Build nested markdown bullets for the index including starting page numbers
        const bullets = groups.map((g) => {
          const parentTitle = g.parent.data.title || g.parent.data.name || '';
          const parentDesc = (g.parent.data.description || '').trim();
          const parentLabel = g.letter;
          const parentPage = labelStartPage[parentLabel];
          const parentSuffix = (typeof parentPage === 'number') ? ` [page ${parentPage}]` : '';
          const parentLine = `- **Exhibit ${parentLabel.toUpperCase()} - ${parentTitle}**${parentDesc ? `: ${parentDesc}` : ''}${parentSuffix}`;

          const childLines = g.children.map((c, idx) => {
            const t = c.data.title || c.data.name || '';
            const d = (c.data.description || '').trim();
            const lbl = `${g.letter}${idx + 1}`;
            const p = labelStartPage[lbl];
            const suf = (typeof p === 'number') ? ` [page ${p}]` : '';
            return `  - **Exhibit ${lbl.toUpperCase()} - ${t}**${d ? `: ${d}` : ''}${suf}`;
          });
          return [parentLine, ...childLines].join('\n');
        }).join('\n');

        const captions = Array.isArray(fragment.captions) ? fragment.captions : [];
        items.push(
          <ExhibitTextPage
            key={`${fragment.id}-index`}
            captions={captions}
            content={bullets}
            pageNumber={cursor + 1}
            totalPages={globalTotalPages}
            title={'Exhibit Index'}
          />
        );
        cursor += 1; // after index
        imageItems.forEach(({ label, exhibit }, idx) => {
          const titleLine = `exhibit ${label.toLowerCase()} - ${exhibit.title || exhibit.name || ''}`;
          // Do not include title in captions; large title only
          items.push(
            <ExhibitTextPage
              key={`${fragment.id}-ex-${idx}-cover`}
              captions={captions}
              content={(exhibit.description || '')}
              pageNumber={cursor + 1}
              totalPages={globalTotalPages}
              title={titleLine}
              coverCentered
            />
          );
          items.push(
            <ImageByRef
              key={`${fragment.id}-ex-${idx}`}
              fileId={exhibit.fileId}
              dataBase64={exhibit.data}
              mimeType={exhibit.mimeType}
              alt={exhibit.title || exhibit.name || 'Exhibit'}
              pageNumber={cursor + 2}
              totalPages={globalTotalPages}
            />
          );
          cursor += 2;
        });
        // Render PDF exhibits with a cover page, then the PDF content
        pdfItems.forEach(({ label, exhibit }, pidx) => {
          const titleLine = `exhibit ${label.toLowerCase()} - ${exhibit.title || exhibit.name || ''}`;
          items.push(
            <ExhibitTextPage
              key={`${fragment.id}-pdf-${pidx}-cover`}
              captions={captions}
              content={(exhibit.description || '')}
              pageNumber={cursor + 1}
              totalPages={globalTotalPages}
              title={titleLine}
              coverCentered
            />
          );
          // advance cursor by cover + actual pdf page count (or 1 until known)
          const key = exhibit.fileId || (exhibit.data ? `data:${(exhibit.data || '').slice(0,64)}` : null);
          const pdfCount = key && pdfCounts[key] ? pdfCounts[key] : 1;
          // PDF content pages will render with their own page footers using the offset below
          items.push(
            <PdfByRef
              key={`${fragment.id}-pdf-${pidx}`}
              fileId={exhibit.fileId}
              dataBase64={exhibit.data}
              pageOffset={cursor + 1}
              totalPages={globalTotalPages}
            />
          );
          cursor += (1 + pdfCount);
        });
      }
    });
    return items;
  }, [fragments, headingSettings, docDate, setFullscreenFragmentId, pdfCounts, mdCounts, globalTotalPages]);

  return (
    <main className="preview-panel">
      <div className="toolbar">
        <button
          type="button"
          onClick={async () => {
            try {
              const text = getRawJson ? await getRawJson() : '';
              setRawText(text || '');
              setRawError('');
              setRawOpen(true);
            } catch (e) {
              // ignore
            }
          }}
          className="secondary"
          title="View and edit the document JSON (without large embedded data)"
        >
          Edit Raw
        </button>
        <button
          type="button"
          onClick={() => {
            const input = document.getElementById('import-json-input');
            if (input) input.click();
          }}
          className="secondary"
          title="Import a previously exported JSON file"
        >
          Import JSON
        </button>
        <input
          id="import-json-input"
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            if (file && onImportBundle) onImportBundle(file);
            // reset so selecting the same file again triggers change
            e.target.value = '';
          }}
        />
        <button type="button" onClick={onExportBundle} className="secondary" title="Export current document as a JSON bundle including assets">
          Export JSON
        </button>
        <button type="button" onClick={onClearAll} className="danger" title="Remove all saved data and reload">
          Clear All Local Data
        </button>
        <button type="button" onClick={onPrint} className="secondary">
          Print or Save as PDF
        </button>
        <button type="button" onClick={onCompilePdf} className="primary">
          Download Combined PDF
        </button>
      </div>
      <div className="preview-scroll" ref={contentRef}>
        {previewFragments.length ? (
          previewFragments
        ) : (
          <div className="empty-state">
            <p>Add Markdown or upload a PDF to begin building your packet.</p>
          </div>
        )}
      </div>

      {fullscreenFragmentId && (
        <FullscreenOverlay onClose={() => setFullscreenFragmentId(null)}>
          {(() => {
            const frag = fragments.find((f) => f.id === fullscreenFragmentId);
            if (!frag || frag.type !== 'markdown') return null;
            // Compute continuous page offset for this fragment
            let overlayOffset = 0;
            for (const f of fragments) {
              if (f.id === frag.id) break;
              if (f.type === 'markdown') {
                overlayOffset += (mdCounts[f.id] || 1);
              } else if (f.type === 'pdf') {
                const k = f.fileId || (f.data ? `data:${(f.data || '').slice(0,64)}` : null);
                overlayOffset += (k && pdfCounts[k]) ? pdfCounts[k] : 1;
              } else if (f.type === 'exhibits') {
                const exhibits = Array.isArray(f.exhibits) ? f.exhibits : [];
                const { groups } = groupExhibits(exhibits);
                const imgs = flattenImageExhibitsWithLabels(groups);
                overlayOffset += (imgs.length * 2) + 1; // images + index
                const pdfs = flattenPdfExhibitsWithLabels(groups);
                pdfs.forEach(({ exhibit }) => {
                  const kk = exhibit.fileId || (exhibit.data ? `data:${(exhibit.data || '').slice(0,64)}` : null);
                  overlayOffset += 1 + ((kk && pdfCounts[kk]) ? pdfCounts[kk] : 1);
                });
              }
            }
            return (
              <div className="fullscreen-content-inner">
                <PaginatedMarkdown
                  content={frag.content}
                  heading={headingSettings}
                  title={frag.title}
                  docDate={docDate}
                  pageOffset={overlayOffset}
                  totalOverride={globalTotalPages}
                  onPageCount={(n) => setMdCounts((prev) => (prev[frag.id] === n ? prev : { ...prev, [frag.id]: n }))}
                />
              </div>
            );
          })()}
        </FullscreenOverlay>
      )}

      {rawOpen && (
        <FullscreenOverlay onClose={() => setRawOpen(false)}>
          <div className="fullscreen-content-inner" style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Edit Raw JSON</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                spellCheck={false}
                style={{ width: '100%', height: '100%', minHeight: '60vh', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12, lineHeight: 1.4, boxSizing: 'border-box' }}
              />
            </div>
            {rawError ? (
              <div style={{ color: '#c0392b' }}>{rawError}</div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="ghost" onClick={() => setRawOpen(false)}>Cancel</button>
              <button
                type="button"
                className="primary"
                onClick={async () => {
                  setRawError('');
                  try {
                    // simple client-side validation first
                    JSON.parse(rawText);
                  } catch (e) {
                    setRawError('Invalid JSON: ' + (e?.message || '')); return;
                  }
                  try {
                    if (onApplyRawJson) await onApplyRawJson(rawText);
                    setRawOpen(false);
                  } catch (e) {
                    setRawError(e?.message || 'Failed to apply JSON');
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        </FullscreenOverlay>
      )}
    </main>
  );
}
