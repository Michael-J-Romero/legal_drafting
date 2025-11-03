'use client';

import React from 'react';
import '/src/App.css';

import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import AppHeader from './components/AppHeader';
import FullscreenOverlay from './components/FullscreenOverlay';
import useDocumentEditor from './hooks/useDocumentEditor';

const TOOL = {
  MENU: 'menu',
  DOCUMENT_BUILDER: 'document-builder',
  PLANNER_AGENT: 'planner-agent',
};

export default function App() {
  const [activeTool, setActiveTool] = React.useState(TOOL.MENU);

  if (activeTool === TOOL.DOCUMENT_BUILDER) {
    return <DocumentBuilderView onBack={() => setActiveTool(TOOL.MENU)} />;
  }

  if (activeTool === TOOL.PLANNER_AGENT) {
    return <PlannerAgentView onBack={() => setActiveTool(TOOL.MENU)} />;
  }

  return (
    <MainMenu
      onSelectDocument={() => setActiveTool(TOOL.DOCUMENT_BUILDER)}
      onSelectPlanner={() => setActiveTool(TOOL.PLANNER_AGENT)}
    />
  );
}

function MainMenu({ onSelectDocument, onSelectPlanner }) {
  return (
    <div className="app-root menu-screen">
      <div className="menu-content" role="navigation" aria-label="Main menu">
        <div className="menu-header">
          <h1>Legal Drafting</h1>
          <p>Select a tool to get started.</p>
        </div>
        <div className="menu-grid">
          <button type="button" className="menu-card" onClick={onSelectDocument}>
            <h2>Create Document</h2>
            <p>Use the document builder to assemble pleadings and filings.</p>
          </button>
          <button type="button" className="menu-card" onClick={onSelectPlanner}>
            <h2>Planner Agent</h2>
            <p>Chat with an AI assistant and plan your next steps (coming soon).</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentBuilderView({ onBack }) {
  const { editorProps, previewProps } = useDocumentEditor();

  const [rawOpen, setRawOpen] = React.useState(false);
  const [rawText, setRawText] = React.useState('');
  const [rawError, setRawError] = React.useState('');

  const [zoom, setZoom] = React.useState(1);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const handleZoomIn = React.useCallback(
    () => setZoom((z) => clamp(Math.round((z + 0.1) * 10) / 10, 0.5, 3)),
    [],
  );
  const handleZoomOut = React.useCallback(
    () => setZoom((z) => clamp(Math.round((z - 0.1) * 10) / 10, 0.5, 3)),
    [],
  );
  const handleZoomReset = React.useCallback(() => setZoom(1), []);

  async function handleOpenRaw() {
    try {
      const text = previewProps.getRawJson ? await previewProps.getRawJson() : '';
      setRawText(text || '');
      setRawError('');
      setRawOpen(true);
    } catch (_) {
      // ignore
    }
  }

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
            {rawError ? <div style={{ color: '#c0392b' }}>{rawError}</div> : null}
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
      <AppHeader title="Planner Agent" onBack={onBack} showDocumentActions={false} />
      <div className="planner-main">
        <div className="planner-panel planner-chat" role="region" aria-label="Planner chat">
          <div className="planner-panel-inner">
            <h2>Conversation</h2>
            <p className="planner-placeholder">Chat interface placeholder.</p>
          </div>
        </div>
        <div className="planner-panel planner-preview" role="region" aria-label="Planner preview">
          <div className="planner-panel-inner">
            <h2>Preview</h2>
            <p className="planner-placeholder">Preview area</p>
          </div>
        </div>
      </div>
    </div>
  );
}
