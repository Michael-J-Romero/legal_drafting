'use client';

import React, { useState } from 'react';
import { LuGripVertical } from 'react-icons/lu';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';

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

  const onDragStart = (e, fromIndex) => {
    try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    e.dataTransfer.setData('text/plain', String(fromIndex));
    setDraggingIndex(fromIndex);
  };
  const onDragOver = (e, toIndex) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
    setDropIndex(toIndex);
  };
  const onDragLeave = (e, toIndex) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dropIndex === toIndex) {
      setDropIndex(null);
    }
  };
  const onDrop = (e, toIndex) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    setDropIndex(null);
    setDraggingIndex(null);
    if (Number.isInteger(from) && from !== toIndex) onReorder(from, toIndex);
  };
  const onDragEnd = () => {
    setDraggingIndex(null);
    setDropIndex(null);
  };

  return (
    <div className="fragment-list sections-only">
      {fragments.map((fragment, index) => {
        const title = fragment.type === 'markdown'
          ? (fragment.title?.trim() || 'Untitled Markdown')
          : (fragment.name || 'PDF');
        const isDragging = draggingIndex === index;
        const isDropTarget = dropIndex === index && draggingIndex !== index;
        return (
          <div
            key={fragment.id}
            className={`fragment-row${isDragging ? ' is-dragging' : ''}${isDropTarget ? ' drop-target' : ''}`}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(event) => onDragOver(event, index)}
            onDragLeave={(event) => onDragLeave(event, index)}
            onDrop={(e) => onDrop(e, index)}
            onDragEnd={onDragEnd}
          >
            <button type="button" className="drag-handle" title="Drag to reorder" aria-label="Drag handle">
              <LuGripVertical aria-hidden="true" />
            </button>
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
                <HiOutlineDotsHorizontal aria-hidden="true" />
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
