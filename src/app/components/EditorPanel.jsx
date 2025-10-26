'use client';

import React from 'react';
import HeadingFieldList from './HeadingFieldList';
import FragmentList from './FragmentList';
import InlineEditorPanel from './InlineEditorPanel';

export default function EditorPanel({
  docDate,
  setDocDate,
  headingExpanded,
  setHeadingExpanded,
  leftHeadingFields,
  rightHeadingFields,
  plaintiffName,
  defendantName,
  courtTitle,
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
}) {
  return (
    <aside className="editor-panel">
      <h1>Document Builder</h1>

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
            <button type="button" className="ghost small" onClick={onAddSectionEnd} title="Add new section">
              + Add Section
            </button>
          </div>
          <FragmentList
            fragments={fragments}
            onReorder={onReorder}
            onRemove={onRemove}
            onInsertBefore={onInsertBefore}
            onInsertAfter={onInsertAfter}
            onItemClick={(frag) => setEditingFragmentId(frag.id)}
          />
        </div>
      ) : (
        <InlineEditorPanel
          fragment={fragments.find((f) => f.id === editingFragmentId)}
          onCancel={() => setEditingFragmentId(null)}
          onChange={onEditFragmentFields}
          onDelete={() => onDeleteEditingFragment(editingFragmentId)}
        />
      )}
    </aside>
  );
}
