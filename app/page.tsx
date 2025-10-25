'use client';

import React, { useMemo, useRef, useState } from 'react';
import DocumentPreview from './components/DocumentPreview';
import PrintControls from './components/PrintControls';
import type { Fragment, MarkdownFragment, PdfFragment } from './components/fragmentTypes';

const demoMarkdown = `# Legal Drafting Preview

This example demonstrates how Markdown fragments render inline with PDF pages.

- Built with **Next.js** and **React**.
- Markdown is parsed with _react-markdown_ and enhanced by remark-gfm.
- PDF pages are rendered via \`react-pdf\`.

> Tip: Replace the placeholder PDF entry below with a valid file path to see it rendered live.

## Tables are supported

| Clause | Description |
| ------ | ----------- |
| 1      | Parties agree to test this preview |
| 2      | Pagination-ready styling keeps print layout predictable |
`;

const pdfPlaceholder: PdfFragment = {
  id: 'pdf-placeholder',
  type: 'pdf',
  src: '/pdfs/sample.pdf'
};

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [includePdf, setIncludePdf] = useState(false);

  const fragments = useMemo<Fragment[]>(() => {
    const markdownFragment: MarkdownFragment = {
      id: 'markdown-intro',
      type: 'markdown',
      content: demoMarkdown
    };

    return includePdf ? [markdownFragment, pdfPlaceholder] : [markdownFragment];
  }, [includePdf]);

  return (
    <main>
      <h1>Live Print Preview</h1>
      <p>
        Toggle the sample PDF fragment to verify how external documents appear
        alongside Markdown content. The PDF entry intentionally points to a
        missing file so you can confirm error states without shipping assets yet.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          type="checkbox"
          checked={includePdf}
          onChange={(event) => setIncludePdf(event.target.checked)}
        />
        Include placeholder PDF fragment
      </label>
      <PrintControls targetRef={containerRef} />
      <DocumentPreview ref={containerRef} fragments={fragments} />
    </main>
  );
}
