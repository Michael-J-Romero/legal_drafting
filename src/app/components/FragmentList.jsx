'use client';

import React, { useState } from 'react';

export default function FragmentList({
  fragments,
  onReorder,
  onRemove,
  onInsertBefore,
  onInsertAfter,
  onItemClick,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);

  const onDragStart = (e, fromIndex) => {
    try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    e.dataTransfer.setData('text/plain', String(fromIndex));
  };
  const onDragOver = (e) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
  };
  const onDrop = (e, toIndex) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isInteger(from) && from !== toIndex) onReorder(from, toIndex);
  };

  return (
    <div className="fragment-list sections-only">
      {fragments.map((fragment, index) => {
        const title = fragment.type === 'markdown'
          ? (fragment.title?.trim() || 'Untitled Markdown')
          : (fragment.name || 'PDF');
        return (
          <div
            key={fragment.id}
            className="fragment-row"
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, index)}
          >
            <button type="button" className="drag-handle" title="Drag to reorder" aria-label="Drag handle">≡</button>
            <button
              type="button"
              className="fragment-title-button"
              onClick={() => onItemClick && onItemClick(fragment)}
              title={title}
            >
              <span className="fragment-index">{index + 1}.</span>
              <span className="fragment-title-text">{title}</span>
            </button>
            <div className="fragment-menu-wrap">
              <button
                type="button"
                className="menu-button"
                aria-haspopup="menu"
                aria-expanded={openMenuId === fragment.id}
                onClick={() => setOpenMenuId((cur) => (cur === fragment.id ? null : fragment.id))}
                title="More actions"
              >
                •••
              </button>
              {openMenuId === fragment.id && (
                <div className="fragment-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); onInsertBefore && onInsertBefore(fragment.id); }}>Insert before</button>
                  <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); onInsertAfter && onInsertAfter(fragment.id); }}>Insert after</button>
                  <button type="button" role="menuitem" className="danger" onClick={() => { setOpenMenuId(null); onRemove(fragment.id); }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
