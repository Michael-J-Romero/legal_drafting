"use client";

import { useMemo, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import FragmentList from "@/components/controls/FragmentList";
import PrintButton from "@/components/controls/PrintButton";
import DocumentPreview from "@/components/preview/DocumentPreview";
import type { ContentFragment } from "@/types/content";

interface PreviewPlaygroundProps {
  initialFragments: ContentFragment[];
}

export default function PreviewPlayground({ initialFragments }: PreviewPlaygroundProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  const orderedFragments = useMemo(() => [...initialFragments], [initialFragments]);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    removeAfterPrint: false,
    documentTitle: "Legal Drafting Preview",
  });

  return (
    <main>
      <div className="preview-shell">
        <section className="preview-pane">
          <div className="controls-card" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <h1 style={{ margin: 0 }}>Live Print Preview</h1>
            <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
              Review Markdown and PDF fragments exactly as they will appear when printed or exported to PDF.
            </p>
          </div>
          <div className="preview-scroll" ref={previewRef}>
            <DocumentPreview fragments={orderedFragments} />
          </div>
        </section>
        <aside className="controls-pane">
          <div className="controls-card">
            <h2>Print or Export</h2>
            <p>Trigger the browser’s native “Print / Save as PDF” workflow using the prepared preview.</p>
            <PrintButton onPrint={handlePrint} disabled={!orderedFragments.length} />
          </div>
          <FragmentList fragments={orderedFragments} />
        </aside>
      </div>
    </main>
  );
}
