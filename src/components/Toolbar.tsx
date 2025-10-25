import React from 'react';
import type { Fragment } from '../types/fragments';
import './Toolbar.css';

type ToolbarProps = {
  onPrint: () => void;
  onCompilePdf: () => Promise<void>;
  fragments: Fragment[];
  isCompiling: boolean;
};

const Toolbar: React.FC<ToolbarProps> = ({ onPrint, onCompilePdf, fragments, isCompiling }) => {
  return (
    <header className="toolbar">
      <div>
        <h1>Legal Drafting Preview</h1>
        <p className="toolbar__summary">{fragments.length} fragment(s) loaded</p>
      </div>
      <div className="toolbar__actions">
        <button type="button" onClick={onPrint} className="toolbar__button">
          Print / Save PDF
        </button>
        <button
          type="button"
          onClick={onCompilePdf}
          className="toolbar__button toolbar__button--secondary"
          disabled={isCompiling}
        >
          {isCompiling ? 'Compiling…' : 'Compile Master PDF'}
        </button>
      </div>
    </header>
  );
};

export default Toolbar;
