import Head from 'next/head';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import DocumentPreview from '@/components/DocumentPreview';
import { usePagedPreview } from '@/hooks/usePagedPreview';
import { assemblePdf } from '@/lib/pdfAssembler';
import type { DocumentFragment } from '@/types/document';

const markdownSample = `# Legal Drafting Preview

This starter shows how Markdown and PDF pages can be stitched together:

- Rich **GitHub-flavoured Markdown** (tables, checklists, etc.).
- Embedded PDF fragments via \`react-pdf\`.
- Native browser printing powered by \`react-to-print\`.

> Add your own pagination, headers/footers, and PDF merging logic next.`;

const fragments: DocumentFragment[] = [
  {
    id: 'intro-markdown',
    kind: 'markdown',
    content: markdownSample,
  },
  {
    id: 'pdf-example',
    kind: 'pdf',
    src: '/sample.pdf',
  },
];

const HomePage = () => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [pagedMode, setPagedMode] = useState(false);
  usePagedPreview(pagedMode);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    documentTitle: 'legal-drafting-preview',
  });

  const handleCompilePdf = useCallback(async () => {
    try {
      const pdfBytes = await assemblePdf(fragments);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'compiled.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to assemble PDF', error);
      alert('PDF assembly is not ready yet. Check the console for details.');
    }
  }, []);

  const pageTitle = useMemo(() => 'Legal Drafting Previewer', []);

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <main className="main">
        <header className="header">
          <h1>{pageTitle}</h1>
          <p>
            Start layering pagination rules, print styles, and PDF merging on top of this minimal
            scaffolding.
          </p>
        </header>

        <section className="toolbar">
          <button type="button" onClick={handlePrint}>
            Print preview
          </button>
          <button type="button" onClick={handleCompilePdf}>
            Compile distribution PDF
          </button>
          <label htmlFor="paged-mode" className="paged-toggle">
            <input
              id="paged-mode"
              type="checkbox"
              checked={pagedMode}
              onChange={(event) => setPagedMode(event.target.checked)}
            />
            Enable Paged.js experimental polyfill
          </label>
        </section>

        <section className="preview-shell">
          <DocumentPreview ref={previewRef} fragments={fragments} />
        </section>
      </main>
    </>
  );
};

export default HomePage;
