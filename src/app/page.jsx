'use client';

import React from 'react';
import '/src/App.css';

import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import AppHeader from './components/AppHeader';
import FullscreenOverlay from './components/FullscreenOverlay';
import useDocumentEditor from './hooks/useDocumentEditor';

const TOOLS = {
  DOCUMENT_BUILDER: 'document-builder',
  PLANNER_AGENT: 'planner-agent',
};

function DocumentBuilderView({ onBack }) {
  const { editorProps, previewProps } = useDocumentEditor();

  // Raw JSON editor state (moved from PreviewPanel toolbar to global header)
  const [rawOpen, setRawOpen] = React.useState(false);
  const [rawText, setRawText] = React.useState('');
  const [rawError, setRawError] = React.useState('');

  // Zoom state for right-side preview (multiplier applied to fit-to-width scale)
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
    <div className="app-root">
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
                    setRawError('Invalid JSON: ' + (e?.message || ''));
                    return;
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
    </div>
  );
}

function PlannerAgentView({ onBack }) {
  return (
    <div className="app-root">
      <AppHeader title="Planner Agent" onBack={onBack} actionsEnabled={false} />
      <div className="planner-main">
        <div className="planner-panel">
          <h2>Conversation</h2>
          <div className="planner-placeholder" style={{ minHeight: 240 }}>
            Chat interface coming soon
          </div>
        </div>
        <div className="planner-panel">
          <h2>Preview</h2>
          <div className="planner-placeholder">Preview area</div>
        </div>
      </div>
    </div>
  );
}

function MainMenu({ onSelectTool }) {
  return (
    <div className="app-root main-menu-root">
      <div className="main-menu-container">
        <div className="main-menu-card">
          <div>
            <div className="main-menu-title">Legal Drafting Workspace</div>
            <p className="main-menu-subtitle">Choose a tool to get started</p>
          </div>
          <div className="main-menu-actions">
            <button
              type="button"
              className="main-menu-button"
              onClick={() => onSelectTool(TOOLS.DOCUMENT_BUILDER)}
            >
              Create document
              <span>Structure and generate legal pleadings with the document builder.</span>
            </button>
            <button
              type="button"
              className="main-menu-button secondary"
              onClick={() => onSelectTool(TOOLS.PLANNER_AGENT)}
            >
              Planner agent
              <span>Collaborate with a planning assistant and review outputs side-by-side.</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTool, setActiveTool] = React.useState(null);

  const handleSelectTool = React.useCallback((tool) => {
    setActiveTool(tool);
  }, []);

  const handleBackToMenu = React.useCallback(() => {
    setActiveTool(null);
  }, []);

  if (activeTool === TOOLS.DOCUMENT_BUILDER) {
    return <DocumentBuilderView onBack={handleBackToMenu} />;
  }

  if (activeTool === TOOLS.PLANNER_AGENT) {
    return <PlannerAgentView onBack={handleBackToMenu} />;
  }

  return <MainMenu onSelectTool={handleSelectTool} />;
}
