import React, { useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type Props = {
  src: string;
  pageRange?: [number, number];
};

export const PdfFragmentPreview: React.FC<Props> = ({ src, pageRange }) => {
  const [start, end] = useMemo(() => {
    if (!pageRange) {
      return [1, undefined];
    }

    const [from, to] = pageRange;
    if (to && to < from) {
      return [from, from];
    }

    return [from, to];
  }, [pageRange]);

  const renderPages = (numPages: number) => {
    const lastPage = end ? Math.min(end, numPages) : numPages;
    const pages = [] as JSX.Element[];
    for (let index = start; index <= lastPage; index += 1) {
      pages.push(
        <Page
          key={`page-${index}`}
          pageNumber={index}
          width={820}
          renderAnnotationLayer={false}
          renderTextLayer
        />,
      );
    }
    return pages;
  };

  return (
    <section className="pdf-fragment">
      <Document file={src} loading={<p>Loading PDF…</p>} renderMode="canvas">
        {({ numPages }) => renderPages(numPages || 0)}
      </Document>
    </section>
  );
};

export default PdfFragmentPreview;
