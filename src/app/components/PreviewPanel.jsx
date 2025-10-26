'use client';

import React, { useMemo } from 'react';
import PdfPreview from './PdfPreview';
import PaginatedMarkdown from './PaginatedMarkdown';
import FullscreenOverlay from './FullscreenOverlay';

export default function PreviewPanel({
  fragments,
  headingSettings,
  docDate,
  onPrint,
  onCompilePdf,
  fullscreenFragmentId,
  setFullscreenFragmentId,
  contentRef,
}) {
  const previewFragments = useMemo(
    () =>
      fragments.map((fragment) => (
        <React.Fragment key={fragment.id}>
          {fragment.type === 'markdown' ? (
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
              <PaginatedMarkdown content={fragment.content} heading={headingSettings} title={fragment.title} docDate={docDate} />
            </div>
          ) : (
            <PdfPreview data={fragment.data} />
          )}
        </React.Fragment>
      )),
    [fragments, headingSettings, docDate, setFullscreenFragmentId]
  );

  return (
    <main className="preview-panel">
      <div className="toolbar">
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
            return (
              <div className="fullscreen-content-inner">
                <PaginatedMarkdown content={frag.content} heading={headingSettings} title={frag.title} docDate={docDate} />
              </div>
            );
          })()}
        </FullscreenOverlay>
      )}
    </main>
  );
}
