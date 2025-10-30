'use client';

import React from 'react';

import EditorPanel from './EditorPanel';
import PreviewPanel from './PreviewPanel';
import useDocumentEditor from '../hooks/useDocumentEditor';

export default function LegalDocumentBuilder({ onExit }) {
  const { editorProps, previewProps } = useDocumentEditor();

  return (
    <div className="builder-shell">
      {onExit && (
        <header className="builder-header">
          <div className="builder-header__info">
            <h1>Legal Document Builder</h1>
            <p>Draft and preview your legal document in real time.</p>
          </div>
          <button type="button" className="secondary-action" onClick={onExit}>
            Back to Menu
          </button>
        </header>
      )}
      <div className="app-shell">
        <EditorPanel {...editorProps} />
        <PreviewPanel {...previewProps} />
      </div>
    </div>
  );
}
