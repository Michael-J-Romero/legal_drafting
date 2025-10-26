'use client';

import React, { useState } from 'react';
import {
  HiOutlineBars3,
  HiEllipsisHorizontal,
  HiOutlineDocumentText,
  HiOutlineDocument,
} from 'react-icons/hi2';

export default function FragmentList({
  fragments,
  onReorder,
  onRemove,
  onInsertBefore,
  onInsertAfter,
  onItemClick,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const onDragStart = (e, fromIndex) => {
    try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    e.dataTransfer.setData('text/plain', String(fromIndex));
    setDraggingIndex(fromIndex);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
  };
  const onDrop = (e, toIndex) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isInteger(from) && from !== toIndex) onReorder(from, toIndex);
    setDraggingIndex(null);
    setDragOverIndex(null);
  };
  const onDragEnter = (index) => {
    setDragOverIndex(index);
  };
  const onDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="fragment-list sections-only">
      {fragments.map((fragment, index) => {
        const title = fragment.type === 'markdown'
          ? (fragment.title?.trim() || 'Untitled Markdown')
          : (fragment.name || 'PDF');
        const isDragging = draggingIndex === index;
        const isDragTarget = dragOverIndex === index && draggingIndex !== index;
        const rowClassName = [
          'fragment-row',
          fragment.type === 'markdown' ? 'markdown' : 'pdf',
          isDragging ? 'is-dragging' : '',
          isDragTarget ? 'drag-target' : '',
        ].filter(Boolean).join(' ');
        return (
          <div
            key={fragment.id}
            className={rowClassName}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, index)}
            onDragEnter={() => onDragEnter(index)}
            onDragEnd={onDragEnd}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setDragOverIndex(null);
              }
            }}
          >
            <button type="button" className="drag-handle" title="Drag to reorder" aria-label="Drag handle">
              <HiOutlineBars3 aria-hidden="true" />
            </button>
            <button
              type="button"
              className="fragment-title-button"
              onClick={() => onItemClick && onItemClick(fragment)}
              title={title}
            >
              <span className="fragment-icon" aria-hidden="true">
                {fragment.type === 'markdown' ? <HiOutlineDocumentText /> : <HiOutlineDocument />}
              </span>
              <span className="fragment-text-wrap">
                <span className="fragment-index">{index + 1}</span>
                <span className="fragment-title-text">{title}</span>
              </span>
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
                <HiEllipsisHorizontal aria-hidden="true" />
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
