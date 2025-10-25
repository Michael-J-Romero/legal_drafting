"use client";

import { forwardRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Document, Page, pdfjs } from "react-pdf";
import styles from "./document-preview.module.css";
import type { DocumentFragment, PdfFragment } from "@/lib/documentTypes";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdf.worker.min.mjs",
    import.meta.url
  ).toString();
}

type DocumentPreviewProps = {
  fragments: DocumentFragment[];
};

type PdfPageState = Record<string, number>;

const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ fragments }, ref) => {
    const [pageCounts, setPageCounts] = useState<PdfPageState>({});

    const handlePdfLoad = (fragment: PdfFragment) =>
      ({ numPages }: { numPages: number }) => {
        setPageCounts((prev) => ({ ...prev, [fragment.id]: numPages }));
      };

    return (
      <div className={styles.previewRoot} ref={ref}>
        {fragments.map((fragment, index) => {
          if (fragment.type === "markdown") {
            return (
              <article className={styles.previewPage} key={fragment.id}>
                <header className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>Markdown</span>
                  <span className={styles.sectionMeta}>Section {index + 1}</span>
                </header>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{
                  fragment.content
                }</ReactMarkdown>
              </article>
            );
          }

          const count = pageCounts[fragment.id] ?? 1;

          return (
            <section className={styles.previewPage} key={fragment.id}>
              <header className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>PDF</span>
                <span className={styles.sectionMeta}>
                  {fragment.title ?? "Attachment"} · {count} page
                  {count === 1 ? "" : "s"}
                </span>
              </header>
              <div className={styles.pdfContainer}>
                <Document
                  file={fragment.src}
                  onLoadSuccess={handlePdfLoad(fragment)}
                  loading={<span className={styles.loading}>Loading PDF…</span>}
                  error={<span className={styles.error}>Unable to load PDF.</span>}
                >
                  {Array.from({ length: count }).map(
                    (_, pageIndex) => (
                      <div className={styles.pdfPageWrapper} key={pageIndex}>
                        <Page
                          pageNumber={pageIndex + 1}
                          renderAnnotationLayer
                          renderTextLayer
                          width={792}
                        />
                        <span className={styles.pageNumber}>
                          Page {pageIndex + 1}
                        </span>
                      </div>
                    )
                  )}
                </Document>
              </div>
            </section>
          );
        })}
      </div>
    );
  }
);

DocumentPreview.displayName = "DocumentPreview";

export default DocumentPreview;
