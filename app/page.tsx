"use client";

import { useMemo, useRef } from "react";
import FragmentPreview from "@/components/preview/FragmentPreview";
import PreviewSidebar from "@/components/preview/PreviewSidebar";
import PrintControls from "@/components/preview/PrintControls";
import type { DocumentFragment } from "@/types/fragments";

const SAMPLE_MARKDOWN = `# Engagement Letter

Welcome to the drafting workspace. This preview mirrors what your clients will see when the
assembled document is printed or exported to PDF.

## Markdown Support

- GitHub-flavored markdown via **remark-gfm**
- Tables, checklists, and block quotes
- Inline formatting like _italics_ and **bold**

> Tip: Combine narrative content with PDF exhibits to create comprehensive legal packets.

| Task | Owner | Status |
| ---- | ----- | ------ |
| Draft engagement letter | Alice | ✅ |
| Review with client | Bob | 🔄 |
`;

const SUPPLEMENTAL_MARKDOWN = `## Next Steps

1. Replace the placeholder markdown with your own clause library.
2. Drop signed exhibits (PDF) into the \`public/samples\` folder or fetch them securely.
3. Implement the \"compiled PDF\" workflow once you're ready to distribute finished packets.
`;

const SAMPLE_FRAGMENTS: DocumentFragment[] = [
  {
    id: "intro-markdown",
    kind: "markdown",
    label: "Engagement Letter",
    content: SAMPLE_MARKDOWN,
  },
  {
    id: "supplemental-markdown",
    kind: "markdown",
    label: "Next Steps",
    content: SUPPLEMENTAL_MARKDOWN,
  },
  {
    id: "sample-pdf",
    kind: "pdf",
    title: "Exhibit A — Sample PDF",
    src: "/samples/example.pdf",
  },
];

export default function Home() {
  const previewRef = useRef<HTMLDivElement>(null);
  const fragments = useMemo(() => SAMPLE_FRAGMENTS, []);

  return (
    <main>
      <h1>Legal Drafting Preview</h1>
      <p>
        Combine markdown narratives and PDF exhibits into a print-ready packet. Use the preview
        below to verify pagination before printing or saving to PDF.
      </p>
      <div className="preview-shell">
        <FragmentPreview ref={previewRef} fragments={fragments} />
        <PreviewSidebar fragments={fragments} />
      </div>
      <PrintControls targetRef={previewRef} documentTitle="legal-drafting-preview" />
    </main>
  );
}
