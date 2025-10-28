'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function FragmentList({
  fragments,
  onReorder,
  onRemove,
  onInsertBefore,
  onInsertAfter,
  onItemClick,
  onPdfReplace,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // Clickaway handler
  useEffect(() => {
    if (!openMenuId) return;
    const handleClickAway = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [openMenuId]);

  // Drag/click logic
  const dragInfo = useRef({ dragging: false });
  const onDragStart = (e, fromIndex) => {
    dragInfo.current.dragging = true;
    try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    e.dataTransfer.setData('text/plain', String(fromIndex));
  };
  const onDragEnd = () => {
    setTimeout(() => { dragInfo.current.dragging = false; }, 0);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
  };
  const onDrop = (e, toIndex) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isInteger(from) && from !== toIndex) onReorder(from, toIndex);
    dragInfo.current.dragging = false;
  };

  // File input ref for PDF replace
  const fileInputRef = useRef(null);

  const handlePdfClick = (fragment) => {
    if (fileInputRef.current) {
      fileInputRef.current.dataset.fragmentId = fragment.id;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const fragmentId = e.target.dataset.fragmentId;
    if (file && fragmentId && onPdfReplace) {
      onPdfReplace(fragmentId, file);
    }
    e.target.value = '';
  };

  return (
    <div className="fragment-list sections-only">
      <input
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      {fragments.map((fragment, index) => {
        const title = fragment.type === 'markdown'
          ? (fragment.title?.trim() || 'Untitled Markdown')
          : fragment.type === 'pdf'
            ? (fragment.name || 'PDF')
            : `Exhibits (${Array.isArray(fragment.exhibits) ? fragment.exhibits.length : 0})`;
        const isPdf = fragment.type === 'pdf';
        return (
          <div
            key={fragment.id}
            className="fragment-row"
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, index)}
            title={title}
            tabIndex={0}
            role="button"
            aria-label={`Fragment ${index + 1}: ${title}`}
            onClick={() => {
              if (!dragInfo.current.dragging) {
                if (isPdf) {
                  handlePdfClick(fragment);
                } else if (onItemClick) {
                  onItemClick(fragment);
                }
              }
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !dragInfo.current.dragging) {
                if (isPdf) {
                  handlePdfClick(fragment);
                } else if (onItemClick) {
                  onItemClick(fragment);
                }
              }
            }}
            style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: '8px', borderBottom: '1px solid #eee' }}
          >
            <span className="drag-icon" style={{ fontSize: 18, marginRight: 8 }}>≡</span>
            <span className="fragment-index" style={{ fontWeight: 'bold', marginRight: 4 }}>{index + 1}.</span>
            <span className="fragment-title-text" style={{ flexGrow: 1 }}>{title}</span>
            <div className="fragment-menu-wrap">
              <button
                type="button"
                className="menu-button"
                aria-haspopup="menu"
                aria-expanded={openMenuId === fragment.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId((cur) => (cur === fragment.id ? null : fragment.id));
                }}
                title="More actions"
              >
                •••
              </button>
              {openMenuId === fragment.id && (
                <div className="fragment-menu" role="menu" ref={menuRef}>
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
/*
css:
.fragment-list {
  .fragment-row {
    display: flex;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid #eee;
    &:hover {
      background-color: #f9f9f9;
    }
    .drag-handle {
      cursor: grab;
      background: none;
      border: none;
      font-size: 18px;
      margin-right: 8px;
    }
    .fragment-title-button {
      flex-grow: 1;
      text-align: left;
      background: none;
      border: none;
      padding: 4px 8px;
      font-size: 16px;
      cursor: pointer;
      .fragment-index {
        font-weight: bold;
        margin-right: 4px;
      }
    }
    .fragment-menu-wrap {
      position: relative;
      .menu-button {
        background: none;
        border: none;
        padding: 4px 8px;
        font-size: 16px;
        cursor: pointer;
      }
      .fragment-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: white;
      } 
    }
  }
}
*/