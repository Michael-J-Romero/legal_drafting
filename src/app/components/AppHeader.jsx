'use client';

import React from 'react';
import {
  FiPrinter,
  FiDownload,
  FiMoreVertical,
  FiCode,
  FiUpload,
  FiTrash2,
  FiZoomIn,
  FiZoomOut,
  FiArrowLeft,
} from 'react-icons/fi';

export default function AppHeader({
  title = 'Legal Drafting',
  onBack,
  onOpenRaw,
  onImportBundle,
  onExportBundle,
  onClearAll,
  onPrint,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  showDocumentActions = true,
}) {
  const fileInputRef = React.useRef(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!showDocumentActions) return undefined;
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showDocumentActions]);

  return (
    <header className="app-header" role="banner">
      <div className="app-header-inner">
        <div className="app-header-left">
          {onBack ? (
            <button
              type="button"
              className="icon-btn"
              onClick={onBack}
              aria-label="Back to menu"
              title="Back to menu"
            >
              <FiArrowLeft />
            </button>
          ) : null}
          <div className="app-title">{title}</div>
        </div>
        {showDocumentActions ? (
          <div className="app-header-actions" ref={menuRef}>
          {/* Zoom controls */}
          <button
            type="button"
            className="icon-btn"
            onClick={onZoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <FiZoomOut />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onZoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <FiZoomIn />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onZoomReset}
            aria-label={`Reset zoom (${Math.round(zoom * 100)}%)`}
            title={`Reset zoom (${Math.round(zoom * 100)}%)`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onPrint}
            aria-label="Print or Save as PDF"
            title="Print or Save as PDF"
          >
            <FiPrinter />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onExportBundle}
            aria-label="Export JSON"
            title="Export JSON"
          >
            <FiDownload />
          </button>

          {/* Right-edge overflow menu */}
          <div className="header-menu-wrap">
            <button
              type="button"
              className="icon-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              title="More actions"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <FiMoreVertical />
            </button>
            {menuOpen && (
              <div className="header-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => { setMenuOpen(false); onOpenRaw && onOpenRaw(); }}
                >
                  <FiCode />
                  <span>Edit Raw JSON</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}
                >
                  <FiUpload />
                  <span>Import JSON</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item danger"
                  onClick={() => { setMenuOpen(false); onClearAll && onClearAll(); }}
                >
                  <FiTrash2 />
                  <span>Clear All Local Data</span>
                </button>
              </div>
            )}
          </div>

          {/* Hidden input for imports */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file && onImportBundle) onImportBundle(file);
              if (e.target) e.target.value = '';
            }}
          />
          </div>
        ) : (
          <div className="app-header-actions" aria-hidden />
        )}
      </div>
    </header>
  );
}
