'use client';

import React from 'react';
import '/src/App.css';

import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import useDocumentEditor from './hooks/useDocumentEditor';

export default function App() {
  const { editorProps, previewProps } = useDocumentEditor();

  return (
    <div className="app-shell">
      <EditorPanel {...editorProps} />
      <PreviewPanel {...previewProps} />
    </div>
  );
}
