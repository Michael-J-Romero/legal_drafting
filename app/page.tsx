"use client";

import { useRef } from "react";
import DocumentPreview from "@/components/DocumentPreview";
import { usePrint } from "@/hooks/usePrint";
import { sampleFragments } from "@/lib/sampleFragments";
import styles from "./page.module.css";

export default function HomePage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const handlePrint = usePrint(previewRef, {
    documentTitle: "Legal Drafting Packet"
  });

  return (
    <main className={styles.layout}>
      <section className={styles.controls}>
        <div>
          <h1>Legal drafting preview</h1>
          <p>
            This workspace stitches Markdown notes and PDF exhibits into a
            single, print-ready flow. Use the button to launch the browser
            print dialog and save a combined PDF.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={handlePrint}>
            Print or save as PDF
          </button>
        </div>
      </section>
      <DocumentPreview ref={previewRef} fragments={sampleFragments} />
    </main>
  );
}
