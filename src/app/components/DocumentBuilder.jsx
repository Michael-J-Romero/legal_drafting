'use client';

import React from 'react';

import EditorPanel from './EditorPanel';
import PreviewPanel from './PreviewPanel';
import useDocumentEditor from '../hooks/useDocumentEditor';

export default function DocumentBuilder({ onExit }) {
  const { editorProps, previewProps } = useDocumentEditor();

  return (
    <div className="document-builder">
      {onExit ? (
        <header className="document-builder__header">
          <button
            type="button"
            className="document-builder__back-button"
            onClick={onExit}
          >
            ← Back to documents
          </button>
        </header>
      ) : null}

      <div className="app-shell">
        <EditorPanel {...editorProps} />
        <PreviewPanel {...previewProps} />
      </div>
    </div>
  );
}
