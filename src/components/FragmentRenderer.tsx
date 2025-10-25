import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { Fragment } from '../types/fragments';
import './fragmentRenderer.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export type FragmentRendererProps = {
  fragment: Fragment;
};

const FragmentRenderer = memo(({ fragment }: FragmentRendererProps) => {
  const [pageCount, setPageCount] = useState<number>(1);

  if (fragment.kind === 'markdown') {
    return (
      <article className="fragment-page" data-fragment-id={fragment.id}>
        {fragment.label ? <h2 className="fragment-heading">{fragment.label}</h2> : null}
        <ReactMarkdown className="markdown" remarkPlugins={[remarkGfm]}>
          {fragment.content}
        </ReactMarkdown>
      </article>
    );
  }

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setPageCount(numPages);
  };

  return (
    <section className="fragment-page" data-fragment-id={fragment.id}>
      {fragment.label ? <h2 className="fragment-heading">{fragment.label}</h2> : null}
      <Document
        file={fragment.source}
        renderMode="canvas"
        className="pdf-fragment"
        onLoadSuccess={handleLoadSuccess}
        loading={<p>Loading PDF…</p>}
        error={<p>Failed to load PDF fragment.</p>}
      >
        {Array.from({ length: pageCount }, (_, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            width={700}
            renderTextLayer
            renderAnnotationLayer
          />
        ))}
      </Document>
    </section>
  );
});

FragmentRenderer.displayName = 'FragmentRenderer';

export default FragmentRenderer;
