'use client';

import React from 'react';
import '/src/App.css';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import useDocumentManager from './hooks/useDocumentManager';

export default function AppPage() {
  const {
    docTitle,
    setDocTitle,
    docDate,
    setDocDate,
    headingExpanded,
    setHeadingExpanded,
    leftHeadingFields,
    rightHeadingFields,
    plaintiffName,
    defendantName,
    courtTitle,
    showPageNumbers,
    setShowPageNumbers,
    handleAddLeftField,
    handleLeftFieldChange,
    handleRemoveLeftField,
    handleAddRightField,
    handleRightFieldChange,
    handleRemoveRightField,
    setPlaintiffName,
    setDefendantName,
    setCourtTitle,
    fragments,
    handleReorderFragments,
    handleRemoveFragmentConfirmed,
    handleInsertBefore,
    handleInsertAfter,
    handleAddSectionEnd,
    handleAddExhibitsSection,
    handleAddPdfSection,
    editingFragmentId,
    setEditingFragmentId,
    handleEditFragmentFields,
    handlePdfReplace,
    fullscreenFragmentId,
    setFullscreenFragmentId,
    headingSettings,
    handlePrint,
    handleCompilePdf,
    handleClearAll,
    handleExportBundle,
    handleImportBundle,
    getRawJson,
    handleApplyRawJson,
    previewRef,
  } = useDocumentManager();

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
