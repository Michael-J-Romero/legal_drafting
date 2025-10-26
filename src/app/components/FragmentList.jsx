'use client';

import React, { useEffect, useState } from 'react';
import {
  FiMoreVertical,
  FiMove,
  FiPlusCircle,
  FiTrash2,
} from 'react-icons/fi';

const initialDragState = {
  draggingIndex: null,
  dropIndex: null,
  position: null,
};

export default function FragmentList({
  fragments,
  onReorder,
  onRemove,
  onInsertBefore,
  onInsertAfter,
  onItemClick,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [dragState, setDragState] = useState(initialDragState);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!event.target.closest('.fragment-menu-wrap')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const resetDragState = () => {
    setDragState(initialDragState);
  };

  const onDragStart = (e, fromIndex) => {
    try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    e.dataTransfer.setData('text/plain', String(fromIndex));
    try { e.dataTransfer.setDragImage(e.currentTarget, 16, 16); } catch (_) {}
    setDragState({ draggingIndex: fromIndex, dropIndex: fromIndex, position: 'above' });
  };
  const onDragOverRow = (e, index) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const position = offsetY < rect.height / 2 ? 'above' : 'below';
    setDragState((current) => {
      if (
        current.dropIndex === index
        && current.position === position
      ) {
        return current;
      }
      return {
        draggingIndex: current.draggingIndex,
        dropIndex: index,
        position,
      };
    });
  };
  const onDrop = (e) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const { draggingIndex, dropIndex, position } = dragState;
    if (!Number.isInteger(from) || draggingIndex === null || dropIndex === null) {
      resetDragState();
      return;
    }

    let targetIndex = dropIndex + (position === 'below' ? 1 : 0);
    if (draggingIndex < targetIndex && dropIndex >= draggingIndex) {
      targetIndex -= 1;
    }

    if (targetIndex !== draggingIndex) {
      onReorder && onReorder(from, targetIndex);
    }
    resetDragState();
  };

  const onListDragOver = (event) => {
    if (!fragments.length) {
      event.preventDefault();
      return;
    }
    if (!event.target.closest('.fragment-row') && dragState.draggingIndex !== null) {
      event.preventDefault();
      setDragState((current) => ({
        draggingIndex: current.draggingIndex,
        dropIndex: fragments.length - 1,
        position: 'below',
      }));
    }
  };

  const onListDrop = (event) => {
    if (!event.target.closest('.fragment-row')) {
      onDrop(event);
    }
  };

  const onDragLeaveRow = (e, index) => {
    const related = e.relatedTarget;
    if (related && e.currentTarget.contains(related)) return;
    setDragState((current) => {
      if (current.dropIndex !== index) return current;
      return { ...current, dropIndex: null, position: null };
    });
  };

  const onDragEnd = () => {
    resetDragState();
  };

  return (
    <div
      className="fragment-list sections-only"
      role="list"
      onDragOver={onListDragOver}
      onDrop={onListDrop}
    >
      {!fragments.length && (
        <div className="fragment-empty" role="note">
          Drag and drop or use “Add Section” to start building your document.
        </div>
      )}
      {fragments.map((fragment, index) => {
        const title = fragment.type === 'markdown'
          ? (fragment.title?.trim() || 'Untitled Markdown')
          : (fragment.name || 'PDF');
        const isMenuOpen = openMenuId === fragment.id;
        const isDragging = dragState.draggingIndex === index;
        const isDropTarget = dragState.dropIndex === index && dragState.draggingIndex !== null;
        const dropPosition = dragState.position;
        const rowClasses = [
          'fragment-row',
          isDragging ? 'is-dragging' : '',
          isDropTarget && dropPosition === 'above' ? 'drop-above' : '',
          isDropTarget && dropPosition === 'below' ? 'drop-below' : '',
        ].filter(Boolean).join(' ');
        return (
          <div
            key={fragment.id}
            className={rowClasses}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => onDragOverRow(e, index)}
            onDrop={(e) => onDrop(e)}
            onDragLeave={(e) => onDragLeaveRow(e, index)}
            onDragEnd={onDragEnd}
            role="listitem"
          >
            <button
              type="button"
              className="drag-handle"
              title="Drag to reorder"
              aria-label="Drag to reorder"
            >
              <FiMove aria-hidden="true" />
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
                aria-expanded={isMenuOpen}
                onClick={() => setOpenMenuId((cur) => (cur === fragment.id ? null : fragment.id))}
                title="More actions"
              >
                <FiMoreVertical aria-hidden="true" />
              </button>
              {isMenuOpen && (
                <div
                  className="fragment-menu"
                  role="menu"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation();
                      setOpenMenuId(null);
                    }
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setOpenMenuId(null); onInsertBefore && onInsertBefore(fragment.id); }}
                  >
                    <FiPlusCircle aria-hidden="true" />
                    Insert before
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setOpenMenuId(null); onInsertAfter && onInsertAfter(fragment.id); }}
                  >
                    <FiPlusCircle aria-hidden="true" />
                    Insert after
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={() => { setOpenMenuId(null); onRemove(fragment.id); }}
                  >
                    <FiTrash2 aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
