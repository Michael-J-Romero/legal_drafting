'use client';

import React, { useEffect, useRef } from 'react';

export default function FullscreenOverlay({ onClose, children }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onBackdrop = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="fullscreen-overlay" ref={overlayRef} onMouseDown={onBackdrop}>
      <div className="fullscreen-header">
        <div className="fullscreen-spacer" />
        <button type="button" className="fullscreen-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="fullscreen-body">
        {children}
      </div>
    </div>
  );
}
