'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import '/src/App.css';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import { useDocumentManager } from './hooks/useDocumentManager';
import { PRINT_DOCUMENT_TITLE } from './lib/defaults';

export default function App() {
  const previewRef = useRef(null);
  const [headingExpanded, setHeadingExpanded] = useState(false);
  const [fullscreenFragmentId, setFullscreenFragmentId] = useState(null);
  const [editingFragmentId, setEditingFragmentId] = useState(null);

  const {
    docState,
    headingSettings,
    setDocTitle,
    setDocDate,
    setPlaintiffName,
    setDefendantName,
    setCourtTitle,
    setShowPageNumbers,
    addLeftHeadingField,
    updateLeftHeadingField,
    removeLeftHeadingField,
    addRightHeadingField,
    updateRightHeadingField,
    removeRightHeadingField,
    replacePdfFragment,
    reorderFragments,
    removeFragment,
    insertFragmentBefore,
    insertFragmentAfter,
    addMarkdownSection,
    addExhibitsSection,
    addPdfSection,
    editFragmentFields,
    getRawJson,
    applyRawJson,
    exportBundle,
    importBundle,
    compilePdf,
    clearAll,
    undo,
    redo,
  } = useDocumentManager();

  const {
    docTitle,
    docDate,
    leftHeadingFields,
    rightHeadingFields,
    plaintiffName,
    defendantName,
    courtTitle,
    showPageNumbers,
    fragments,
  } = docState;

  const handlePrint = useReactToPrint({
    contentRef: previewRef,
    documentTitle: (docTitle && docTitle.trim()) || PRINT_DOCUMENT_TITLE,
  });

  const handleRemoveFragment = useCallback(
    (id) => {
      const removed = removeFragment(id);
      if (removed && editingFragmentId === id) {
        setEditingFragmentId(null);
      }
    },
    [removeFragment, editingFragmentId, setEditingFragmentId],
  );

  const handleInsertBefore = useCallback(
    (id) => {
      const newId = insertFragmentBefore(id);
      if (newId) {
        setEditingFragmentId(newId);
      }
    },
    [insertFragmentBefore, setEditingFragmentId],
  );

  const handleInsertAfter = useCallback(
    (id) => {
      const newId = insertFragmentAfter(id);
      if (newId) {
        setEditingFragmentId(newId);
      }
    },
    [insertFragmentAfter, setEditingFragmentId],
  );

  const handleAddSectionEnd = useCallback(() => {
    const newId = addMarkdownSection();
    if (newId) {
      setEditingFragmentId(newId);
    }
  }, [addMarkdownSection, setEditingFragmentId]);

  const handleAddExhibitsSection = useCallback(() => {
    const newId = addExhibitsSection();
    if (newId) {
      setEditingFragmentId(newId);
    }
  }, [addExhibitsSection, setEditingFragmentId]);

  const handleAddPdfSection = useCallback(
    (file) => {
      addPdfSection(file).then((newId) => {
        if (newId) {
          setEditingFragmentId(newId);
        }
      });
    },
    [addPdfSection, setEditingFragmentId],
  );

  useEffect(() => {
    const onKey = (event) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="app-shell">
      <EditorPanel
        docTitle={docTitle}
        setDocTitle={setDocTitle}
        docDate={docDate}
        setDocDate={setDocDate}
        headingExpanded={headingExpanded}
        setHeadingExpanded={setHeadingExpanded}
        leftHeadingFields={leftHeadingFields}
        rightHeadingFields={rightHeadingFields}
        plaintiffName={plaintiffName}
        defendantName={defendantName}
        courtTitle={courtTitle}
        showPageNumbers={showPageNumbers !== false}
        setShowPageNumbers={setShowPageNumbers}
        onAddLeftField={addLeftHeadingField}
        onLeftFieldChange={updateLeftHeadingField}
        onRemoveLeftField={removeLeftHeadingField}
        onAddRightField={addRightHeadingField}
        onRightFieldChange={updateRightHeadingField}
        onRemoveRightField={removeRightHeadingField}
        setPlaintiffName={setPlaintiffName}
        setDefendantName={setDefendantName}
        setCourtTitle={setCourtTitle}
        fragments={fragments}
        onReorder={reorderFragments}
        onRemove={handleRemoveFragment}
        onInsertBefore={handleInsertBefore}
        onInsertAfter={handleInsertAfter}
        onAddSectionEnd={handleAddSectionEnd}
        onAddExhibitsSection={handleAddExhibitsSection}
        onAddPdfSection={handleAddPdfSection}
        editingFragmentId={editingFragmentId}
        setEditingFragmentId={setEditingFragmentId}
        onEditFragmentFields={editFragmentFields}
        onDeleteEditingFragment={handleRemoveFragment}
        onPdfReplace={replacePdfFragment}
      />

      <PreviewPanel
        fragments={fragments}
        headingSettings={headingSettings}
        docDate={docDate}
        showPageNumbers={showPageNumbers !== false}
        onPrint={handlePrint}
        onCompilePdf={compilePdf}
        onClearAll={clearAll}
        onExportBundle={exportBundle}
        onImportBundle={importBundle}
        getRawJson={getRawJson}
        onApplyRawJson={applyRawJson}
        fullscreenFragmentId={fullscreenFragmentId}
        setFullscreenFragmentId={setFullscreenFragmentId}
        contentRef={previewRef}
      />
    </div>
  );
}
