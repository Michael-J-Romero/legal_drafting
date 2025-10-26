'use client';

import React, { useMemo, useState } from 'react';
import { LuGripVertical, LuFileText, LuFile } from 'react-icons/lu';
import { HiMiniEllipsisVertical } from 'react-icons/hi2';

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
  const [dropIndex, setDropIndex] = useState(null);

  const fragmentTypeLabels = useMemo(() => ({
    markdown: 'Markdown section',
    pdf: 'PDF attachment',
  }), []);

  const onDragStart = (e, fromIndex) => {
    try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    e.dataTransfer.setData('text/plain', String(fromIndex));
    setOpenMenuId(null);
    setDraggingIndex(fromIndex);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
  };
  const onDragEnter = (e, toIndex) => {
    if (draggingIndex === null || draggingIndex === toIndex) return;
    setDropIndex(toIndex);
  };
  const onDragLeave = (e, toIndex) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropIndex((current) => (current === toIndex ? null : current));
    }
  };
  const onDrop = (e, toIndex) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    setDropIndex(null);
    setDraggingIndex(null);
    if (Number.isInteger(from) && (from !== toIndex || toIndex === fragments.length)) {
      onReorder(from, toIndex);
    }
  };
  const onDragEnd = () => {
    setDraggingIndex(null);
    setDropIndex(null);
  };

  const handleDropAtEnd = (event) => {
    onDragOver(event);
    onDrop(event, fragments.length);
  };

  return (
    <div className="fragment-list sections-only">
      {fragments.length === 0 && (
        <div className="fragment-empty-state">
          <p>No sections yet.</p>
          <p className="fragment-empty-subtext">Use the “Add Section” button to start outlining your document.</p>
        </div>
      )}
      {fragments.map((fragment, index) => {
        const title = fragment.type === 'markdown'
          ? (fragment.title?.trim() || 'Untitled Markdown')
          : (fragment.name || 'PDF');
        const isDragging = draggingIndex === index;
        const isDragOver = dropIndex === index && draggingIndex !== null && draggingIndex !== index;
        const typeLabel = fragmentTypeLabels[fragment.type] || 'Section';
        const TypeIcon = fragment.type === 'markdown' ? LuFileText : LuFile;
        return (
          <div
            key={fragment.id}
            className={`fragment-row${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={onDragOver}
            onDragEnter={(e) => onDragEnter(e, index)}
            onDragLeave={(e) => onDragLeave(e, index)}
            onDrop={(e) => onDrop(e, index)}
            onDragEnd={onDragEnd}
          >
            {isDragOver && <span className="fragment-drop-indicator" aria-hidden="true" />}
            <button
              type="button"
              className="drag-handle"
              title="Drag to reorder"
              aria-label="Drag handle"
            >
              <LuGripVertical aria-hidden="true" />
            </button>
            <button
              type="button"
              className="fragment-title-button"
              onClick={() => onItemClick && onItemClick(fragment)}
              title={title}
            >
              <span className="fragment-type-icon" aria-hidden="true">
                <TypeIcon />
              </span>
              <span className="fragment-index" aria-hidden="true">{index + 1}</span>
              <span className="fragment-title-text">{title}</span>
              <span className="fragment-type">{typeLabel}</span>
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
                <HiMiniEllipsisVertical aria-hidden="true" />
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
      {fragments.length > 0 && (
        <div
          className={`fragment-drop-zone${dropIndex === null && draggingIndex !== null ? ' visible' : ''}`}
          onDragOver={onDragOver}
          onDragEnter={() => setDropIndex(null)}
          onDrop={handleDropAtEnd}
        >
          <span>Drop here to move to the end</span>
        </div>
      )}
    </div>
  );
}
