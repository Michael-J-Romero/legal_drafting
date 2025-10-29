'use client';

import React, { useEffect, useRef } from 'react';

function propDiff(prev, next) {
  const diffs = [];
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return ['__len'];
  for (const k of prevKeys) {
    if (prev[k] !== next[k]) diffs.push(k);
  }
  return diffs;
}

function InlineEditorPanel({ fragment, onCancel, onChange, onDelete }) {
  if (!fragment || fragment.type !== 'markdown') return null;
  const renderRef = useRef(0);
  useEffect(() => {
    // debug noop
    // eslint-disable-next-line no-unused-expressions
    renderRef.current;
  });
  return (
    <div className="card editor-inline">
      <div className="editor-fullscreen-header">
        <h3>Edit Section</h3>
        <div className="editor-fullscreen-actions">
          <button type="button" className="danger" onClick={onDelete}>Delete</button>
          <button type="button" className="secondary" onClick={onCancel}>Back</button>
        </div>
      </div>
      <div className="editor-fullscreen-form">
        <input
          type="text"
          className="heading-input editor-fullscreen-title"
          placeholder="Entry title"
          value={fragment.title || ''}
          onChange={(e) => onChange && onChange(fragment.id, { title: e.target.value })}
        />
        <div>
          <label className="heading-label" htmlFor="section-signature-type">Signature type</label>
          <select
            id="section-signature-type"
            className="heading-input"
            value={(fragment.signatureType || 'default')}
            onChange={(e) => onChange && onChange(fragment.id, { signatureType: e.target.value })}
          >
            <option value="default">Default</option>
            <option value="proposed-order">Proposed order</option>
          </select>
        </div>
        <textarea
          className="markdown-editor editor-fullscreen-textarea"
          placeholder="## Title\n\nDraft your content here..."
          value={fragment.content || ''}
          onChange={(e) => onChange && onChange(fragment.id, { content: e.target.value })}
        />
      </div>
    </div>
  );
}

export default React.memo(InlineEditorPanel, (prev, next) => {
  const diffs = propDiff(prev, next);
  return diffs.length === 0;
});
