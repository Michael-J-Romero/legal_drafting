"use client";

import { useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { MarkdownFragment } from "@/components/MarkdownFragment";
import { PdfFragment } from "@/components/PdfFragment";
import { usePagedJs } from "@/hooks/usePagedJs";
import { compileFragmentsToPdf } from "@/lib/pdfAssembler";
import type { DocumentFragment } from "@/lib/types";
import styles from "@/styles/PrintPreview.module.css";

type Props = {
  fragments: DocumentFragment[];
  enablePagedJs?: boolean;
};

export function PrintPreview({ fragments, enablePagedJs = false }: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<string | null>(null);

  usePagedJs(enablePagedJs);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    documentTitle: "legal-drafting-preview"
  });

  const orderedFragments = useMemo(() => fragments, [fragments]);

  const handleCompile = async () => {
    setIsCompiling(true);
    setCompileStatus(null);
    try {
      await compileFragmentsToPdf(orderedFragments);
      setCompileStatus("PDF compilation stub executed. Replace with full workflow when ready.");
    } catch (error) {
      console.error(error);
      setCompileStatus("Compilation failed. Check console for details.");
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Print Preview</h1>
          <p className={styles.subtitle}>
            Arrange Markdown and PDF fragments exactly as they will print.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={handlePrint} className={styles.primaryAction}>
            Print / Save PDF
          </button>
          <button
            type="button"
            onClick={handleCompile}
            className={styles.secondaryAction}
            disabled={isCompiling}
          >
            {isCompiling ? "Preparing…" : "Compile (stub)"}
          </button>
        </div>
      </header>

      {compileStatus && <p className={styles.status}>{compileStatus}</p>}

      <div className={styles.previewContainer} ref={previewRef}>
        {orderedFragments.map((fragment) => {
          if (fragment.kind === "markdown") {
            return <MarkdownFragment key={fragment.id} fragment={fragment} />;
          }

          if (fragment.kind === "pdf") {
            return <PdfFragment key={fragment.id} fragment={fragment} />;
          }

          return null;
        })}
      </div>
    </div>
  );
}
