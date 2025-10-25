"use client";

import type { DocumentConfig } from "@/lib/fragments";
import { DocumentPreview } from "./DocumentPreview";
import { usePrintControls } from "@/components/printing/usePrintControls";

export type PreviewPlaygroundProps = {
  document: DocumentConfig;
};

export function PreviewPlayground({ document }: PreviewPlaygroundProps) {
  const { handlePrint, registerTarget } = usePrintControls();

  return (
    <div className="preview-grid">
      <aside className="preview-grid__sidebar">
        <h2>Fragments</h2>
        <ol>
          {document.fragments.map((fragment) => (
            <li key={fragment.id}>
              <strong>{fragment.kind.toUpperCase()}</strong>
              {"label" in fragment && fragment.label ? ` · ${fragment.label}` : null}
            </li>
          ))}
        </ol>
        <button onClick={handlePrint}>Print or Save PDF</button>
        <p>
          This playground renders Markdown immediately. PDF fragments are wired up
          but use a placeholder until you provide a file path.
        </p>
      </aside>
      <section className="preview-grid__main">
        <DocumentPreview
          ref={(node) => {
            registerTarget(node);
          }}
          document={document}
        />
      </section>
    </div>
  );
}
