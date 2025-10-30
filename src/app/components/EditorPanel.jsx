'use client';

import React from 'react';
import HeadingFieldList from './HeadingFieldList';
import FragmentList from './FragmentList';
import InlineEditorPanel from './InlineEditorPanel';
import ExhibitsEditorPanel from './ExhibitsEditorPanel';

export default function EditorPanel({
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
  onAddLeftField,
  onLeftFieldChange,
  onRemoveLeftField,
  onAddRightField,
  onRightFieldChange,
  onRemoveRightField,
  setPlaintiffName,
  setDefendantName,
  setCourtTitle,
  fragments,
  onReorder,
  onRemove,
  onInsertBefore,
  onInsertAfter,
  onAddSectionEnd,
  editingFragmentId,
  setEditingFragmentId,
  onEditFragmentFields,
  onDeleteEditingFragment,
  onPdfReplace,
  onAddPdfSection,
  onAddExhibitsSection,
}) {
  // Add state for popup menu
  const [showAddMenu, setShowAddMenu] = React.useState(false);

  // Handler for section type selection
  function onAddSectionType(type) {
    if (type === 'pdf') {
      if (typeof window !== 'undefined') {
        // Trigger file picker for PDF
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file && onAddPdfSection) {
            onAddPdfSection(file);
          }
        };
        input.click();
      }
    } else if (type === 'pleading') {
      if (onAddSectionEnd) {
        onAddSectionEnd();
      }
    } else if (type === 'exhibits') {
      if (onAddExhibitsSection) {
        onAddExhibitsSection();
      }
    }
  }

  return (
    <aside className="editor-panel">
      <h1>Document Builder</h1>

      <div className="card">
        <label htmlFor="doc-title-input">Document title</label>
        <input
          id="doc-title-input"
          type="text"
          className="heading-input"
          value={docTitle}
          onChange={(e) => setDocTitle(e.target.value)}
          placeholder="Untitled document"
        />
      </div>

      <div className="card">
        <label htmlFor="doc-date-input">Document date (applies to all sections)</label>
        <input
          id="doc-date-input"
          type="date"
          className="heading-input"
          value={docDate}
          onChange={(e) => setDocDate(e.target.value)}
        />
      </div>

      <div className="card">
        <label htmlFor="page-numbers-toggle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="page-numbers-toggle"
            type="checkbox"
            checked={showPageNumbers !== false}
            onChange={(e) => setShowPageNumbers && setShowPageNumbers(e.target.checked)}
          />
          Show page numbers in footer
        </label>
        <div className="help-text" style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
          Applies to on-screen preview, printing, and the compiled PDF.
        </div>
      </div>

      <div className={`card heading-card${headingExpanded ? ' expanded' : ''}`}>
        <button
          type="button"
          className="heading-toggle"
          onClick={() => setHeadingExpanded((current) => !current)}
          aria-expanded={headingExpanded}
        >
          <span>Pleading heading</span>
          <span className="heading-toggle-icon">{headingExpanded ? '−' : '+'}</span>
        </button>
        {headingExpanded && (
          <div className="heading-editor">
            <HeadingFieldList
              label="Left-side contact lines"
              fields={leftHeadingFields}
              onAdd={onAddLeftField}
              onRemove={onRemoveLeftField}
              onChange={onLeftFieldChange}
            />

            <div className="heading-party-grid">
              <div className="heading-party-field">
                <label className="heading-label" htmlFor="plaintiff-input">
                  Plaintiff name
                </label>
                <input
                  id="plaintiff-input"
                  type="text"
                  value={plaintiffName}
                  onChange={(event) => setPlaintiffName(event.target.value)}
                  className="heading-input"
                />
              </div>
              <div className="heading-party-field">
                <label className="heading-label" htmlFor="defendant-input">
                  Defendant name
                </label>
                <input
                  id="defendant-input"
                  type="text"
                  value={defendantName}
                  onChange={(event) => setDefendantName(event.target.value)}
                  className="heading-input"
                />
              </div>
            </div>

            <HeadingFieldList
              label="Right-side caption details"
              fields={rightHeadingFields}
              onAdd={onAddRightField}
              onRemove={onRemoveRightField}
              onChange={onRightFieldChange}
            />

            <label className="heading-label" htmlFor="court-title-input">Court/Venue title</label>
            <input
              id="court-title-input"
              type="text"
              value={courtTitle}
              onChange={(event) => setCourtTitle(event.target.value)}
              className="heading-input"
              placeholder="e.g., COUNTY OF SAN BERNARDINO"
            />
          </div>
        )}
      </div>

      {/* Sections list or editor */}
      {!editingFragmentId ? (
        <div className="card">
          <div className="card-header-row">
            <span>Sections</span>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button type="button" className="ghost small" onClick={() => setShowAddMenu(true)} title="Add new section">
                + Add Section
              </button>
              {showAddMenu && (
                <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10, background: '#fff', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  <button type="button" style={{ display: 'block', width: '100%' }} onClick={() => { setShowAddMenu(false); onAddSectionType('pdf'); }}>PDF Section</button>
                  <button type="button" style={{ display: 'block', width: '100%' }} onClick={() => { setShowAddMenu(false); onAddSectionType('pleading'); }}>Pleading Paper Section</button>
                  <button type="button" style={{ display: 'block', width: '100%' }} onClick={() => { setShowAddMenu(false); onAddSectionType('exhibits'); }}>Exhibits Section</button>
                </div>
              )}
            </div>
          </div>
          <FragmentList
            fragments={fragments}
            onReorder={onReorder}
            onRemove={onRemove}
            onInsertBefore={onInsertBefore}
            onInsertAfter={onInsertAfter}
            onItemClick={(frag) => setEditingFragmentId(frag.id)}
            onPdfReplace={onPdfReplace}
          />
        </div>
  ) : (
        (fragments.find((f) => f.id === editingFragmentId)?.type === 'exhibits') ? (
          <ExhibitsEditorPanel
            fragment={fragments.find((f) => f.id === editingFragmentId)}
            onCancel={() => setEditingFragmentId(null)}
            onChange={onEditFragmentFields}
            onDelete={() => onDeleteEditingFragment(editingFragmentId)}
          />
        ) : (
          <InlineEditorPanel
            fragment={fragments.find((f) => f.id === editingFragmentId)}
            onCancel={() => setEditingFragmentId(null)}
            onChange={onEditFragmentFields}
            onDelete={() => onDeleteEditingFragment(editingFragmentId)}
          />
        )
      )}
    </aside>
  );
}
