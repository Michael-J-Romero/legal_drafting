import React, { useCallback, useRef, useState } from 'react';
import type { Fragment, MarkdownFragment, PdfFragment } from '../types/fragments';
import './FragmentForm.css';

type FragmentFormProps = {
  onAddFragment: (fragment: Fragment) => void;
};

const FragmentForm: React.FC<FragmentFormProps> = ({ onAddFragment }) => {
  const [markdownValue, setMarkdownValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const handleMarkdownSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!markdownValue.trim()) {
        return;
      }

      const fragment: MarkdownFragment = {
        id: `markdown-${crypto.randomUUID()}`,
        type: 'markdown',
        content: markdownValue,
      };

      onAddFragment(fragment);
      setMarkdownValue('');
    },
    [markdownValue, onAddFragment],
  );

  const handlePdfChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setIsUploading(true);

      try {
        const objectUrl = URL.createObjectURL(file);
        const fragment: PdfFragment = {
          id: `pdf-${crypto.randomUUID()}`,
          type: 'pdf',
          src: objectUrl,
          label: file.name,
        };
        onAddFragment(fragment);
      } finally {
        if (pdfInputRef.current) {
          pdfInputRef.current.value = '';
        }
        setIsUploading(false);
      }
    },
    [onAddFragment],
  );

  return (
    <section className="fragment-form">
      <form onSubmit={handleMarkdownSubmit} className="fragment-form__markdown">
        <label htmlFor="markdown-fragment">New Markdown fragment</label>
        <textarea
          id="markdown-fragment"
          value={markdownValue}
          onChange={(event) => setMarkdownValue(event.target.value)}
          placeholder="Enter Markdown (tables, checklists, etc.)"
          rows={6}
        />
        <div className="fragment-form__actions">
          <button type="submit" disabled={!markdownValue.trim()}>Add Markdown</button>
        </div>
      </form>
      <div className="fragment-form__divider" aria-hidden="true">
        <span>or</span>
      </div>
      <div className="fragment-form__upload">
        <label htmlFor="pdf-upload">Attach PDF fragment</label>
        <input
          id="pdf-upload"
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          onChange={handlePdfChange}
          disabled={isUploading}
        />
        <p className="fragment-form__hint">
          PDFs are rendered page-by-page in the preview and preserved when compiling a master PDF.
        </p>
      </div>
    </section>
  );
};

export default FragmentForm;
