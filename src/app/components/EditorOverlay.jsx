'use client';

import React, { useState } from 'react';
import FullscreenOverlay from './FullscreenOverlay';

export default function EditorOverlay({ fragment, onClose, onSave }) {
  const [title, setTitle] = useState(fragment?.title || '');
  const [content, setContent] = useState(fragment?.content || '');

  if (!fragment || fragment.type !== 'markdown') return null;

  return (
    <FullscreenOverlay onClose={onClose}>
      <div className="editor-fullscreen-container">
        <div className="editor-fullscreen-header">
          <h3>Edit Markdown Entry</h3>
          <div className="editor-fullscreen-actions">
            <button
              type="button"
              className="secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => onSave && onSave({ id: fragment.id, title: title?.trim() || 'Untitled', content })}
            >
              Save
            </button>
          </div>
        </div>
        <div className="editor-fullscreen-form">
          <input
            type="text"
            className="heading-input editor-fullscreen-title"
            placeholder="Entry title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="markdown-editor editor-fullscreen-textarea"
            placeholder="## Title\n\nDraft your content here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>
    </FullscreenOverlay>
  );
}
