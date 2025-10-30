'use client';

import React from 'react';
import '/src/App.css';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import { useDocumentManager } from './hooks/useDocumentManager';

export default function App() {
  const {
    docState,
    headingSettings,
    headingExpanded,
    setHeadingExpanded,
    fullscreenFragmentId,
    setFullscreenFragmentId,
    editingFragmentId,
    setEditingFragmentId,
    previewRef,
    fieldUpdaters,
    actions,
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

  const {
    setDocTitle,
    setDocDate,
    setPlaintiffName,
    setDefendantName,
    setCourtTitle,
    setShowPageNumbers,
  } = fieldUpdaters;

  const {
    handleAddLeftField,
    handleLeftFieldChange,
    handleRemoveLeftField,
    handleAddRightField,
    handleRightFieldChange,
    handleRemoveRightField,
    handlePdfReplace,
    handleReorderFragments,
    handleRemoveFragmentConfirmed,
    handleInsertBefore,
    handleInsertAfter,
    handleAddSectionEnd,
    handleAddExhibitsSection,
    handleAddPdfSection,
    handleEditFragmentFields,
    handleClearAll,
    handlePrint,
    handleCompilePdf,
    handleExportBundle,
    handleImportBundle,
    getRawJson,
    handleApplyRawJson,
  } = actions;

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
        onAddLeftField={handleAddLeftField}
        onLeftFieldChange={handleLeftFieldChange}
        onRemoveLeftField={handleRemoveLeftField}
        onAddRightField={handleAddRightField}
        onRightFieldChange={handleRightFieldChange}
        onRemoveRightField={handleRemoveRightField}
        setPlaintiffName={setPlaintiffName}
        setDefendantName={setDefendantName}
        setCourtTitle={setCourtTitle}
        fragments={fragments}
        onReorder={handleReorderFragments}
        onRemove={handleRemoveFragmentConfirmed}
        onInsertBefore={handleInsertBefore}
        onInsertAfter={handleInsertAfter}
        onAddSectionEnd={handleAddSectionEnd}
        onAddExhibitsSection={handleAddExhibitsSection}
        onAddPdfSection={handleAddPdfSection}
        editingFragmentId={editingFragmentId}
        setEditingFragmentId={setEditingFragmentId}
        onEditFragmentFields={handleEditFragmentFields}
        onDeleteEditingFragment={handleRemoveFragmentConfirmed}
        onPdfReplace={handlePdfReplace}
      />

      <PreviewPanel
        fragments={fragments}
        headingSettings={headingSettings}
        docDate={docDate}
        showPageNumbers={showPageNumbers !== false}
        onPrint={handlePrint}
        onCompilePdf={handleCompilePdf}
        onClearAll={handleClearAll}
        onExportBundle={handleExportBundle}
        onImportBundle={handleImportBundle}
        getRawJson={getRawJson}
        onApplyRawJson={handleApplyRawJson}
        fullscreenFragmentId={fullscreenFragmentId}
        setFullscreenFragmentId={setFullscreenFragmentId}
        contentRef={previewRef}
      />
    </div>
  );
}
