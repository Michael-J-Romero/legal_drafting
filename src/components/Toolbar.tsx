import React from 'react';

interface ToolbarProps {
  onPrint: () => void;
  onDownload: () => void;
  isPrinting: boolean;
  isCompiling: boolean;
}

export function Toolbar({ onPrint, onDownload, isPrinting, isCompiling }: ToolbarProps) {
  return (
    <div className="toolbar">
      <h1 className="toolbar__title">Legal Drafting Preview</h1>
      <p className="toolbar__subtitle">
        Combine Markdown notes and PDF exhibits into a single, printable packet.
      </p>
      <div className="toolbar__actions">
        <button className="toolbar__button" onClick={onPrint} disabled={isPrinting}>
          {isPrinting ? 'Preparing…' : 'Print / Save as PDF'}
        </button>
        <button className="toolbar__button toolbar__button--secondary" onClick={onDownload} disabled={isCompiling}>
          {isCompiling ? 'Compiling…' : 'Download merged PDF'}
        </button>
      </div>
    </div>
  );
}
