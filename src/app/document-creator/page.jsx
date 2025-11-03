'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import '/src/App.css';

import AppHeader from '../components/AppHeader';
import EditorPanel from '../components/EditorPanel';
import PreviewPanel from '../components/PreviewPanel';
import FullscreenOverlay from '../components/FullscreenOverlay';
import useDocumentEditor from '../hooks/useDocumentEditor';

function DocumentBuilder({ onBack }) {
  const { editorProps, previewProps } = useDocumentEditor();

  const [rawOpen, setRawOpen] = React.useState(false);
  const [rawText, setRawText] = React.useState('');
  const [rawError, setRawError] = React.useState('');

  const [zoom, setZoom] = React.useState(1);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const handleZoomIn = React.useCallback(() => setZoom((z) => clamp(Math.round((z + 0.1) * 10) / 10, 0.5, 3)), []);
  const handleZoomOut = React.useCallback(() => setZoom((z) => clamp(Math.round((z - 0.1) * 10) / 10, 0.5, 3)), []);
  const handleZoomReset = React.useCallback(() => setZoom(1), []);

  const handleOpenRaw = React.useCallback(async () => {
    try {
      const text = previewProps.getRawJson ? await previewProps.getRawJson() : '';
      setRawText(text || '');
      setRawError('');
      setRawOpen(true);
    } catch (_) {
      // ignore
    }
  }, [previewProps]);

  return (
    <>
      <AppHeader
        title="Document Builder"
        onBack={onBack}
        onOpenRaw={handleOpenRaw}
        onImportBundle={previewProps.onImportBundle}
        onExportBundle={previewProps.onExportBundle}
        onClearAll={previewProps.onClearAll}
        onPrint={previewProps.onPrint}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />
      <div className="app-main">
        <EditorPanel {...editorProps} />
        <PreviewPanel {...previewProps} zoom={zoom} />
      </div>

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
                    JSON.parse(rawText);
                  } catch (e) {
                    setRawError('Invalid JSON: ' + (e?.message || '')); return;
                  }
                  try {
                    if (previewProps.onApplyRawJson) await previewProps.onApplyRawJson(rawText);
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
    </>
  );
}

export default function DocumentCreatorPage() {
  const router = useRouter();
  return <DocumentBuilder onBack={() => router.push('/')} />;
}
