'use client';

import { useMemo, useRef } from 'react';
import DocumentPreview from '@/components/preview/DocumentPreview';
import { usePagedPreview } from '@/hooks/usePagedPreview';
import { usePrint } from '@/hooks/usePrint';
import type { PrintFragment } from '@/types/fragments';

const sampleMarkdown = `# Legal drafting toolkit

This preview stitches together **Markdown** and **PDF** fragments so your team
can iterate quickly while staying confident about final pagination.

## Features demonstrated

- Paginated PDF preview powered by [react-pdf](https://github.com/wojtekmaj/react-pdf)
- Markdown rendered with GitHub-flavoured extensions via \`remark-gfm\`
- A single print action (browser print dialog) controlled by \`react-to-print\`
- Room for advanced pagination helpers such as \`pagedjs\`

| Capability | Status |
| --- | --- |
| Markdown layout | ✅ Ready for content |
| Embedded PDFs | ✅ Inline preview |
| Compiled PDF export | 🚧 Planned |
`;

const secondaryMarkdown = `### Next steps

1. Drop in your own Markdown fragments.
2. Replace the sample PDF with production assets.
3. Wire up the \`assemblePdfFromFragments\` helper to compile a distribution PDF.`;

export default function Home() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const handlePrint = usePrint(previewRef);

  // Flip the flag once you want paged.js to enhance the preview.
  usePagedPreview(false);

  const fragments = useMemo<PrintFragment[]>(
    () => [
      {
        id: 'markdown-intro',
        type: 'markdown',
        content: sampleMarkdown,
        label: 'Project overview',
      },
      {
        id: 'pdf-example',
        type: 'pdf',
        source: '/sample.pdf',
        label: 'Embedded PDF fragment',
      },
      {
        id: 'markdown-next-steps',
        type: 'markdown',
        content: secondaryMarkdown,
        label: 'Implementation notes',
      },
    ],
    [],
  );

  return (
    <main>
      <div className="preview-layout">
        <aside className="preview-metadata">
          <h1>Legal drafting preview sandbox</h1>
          <p>
            Use this workspace to orchestrate Markdown and PDF fragments into a single
            print-ready narrative. The layout is optimised for on-screen review as well as the
            browser&#39;s native print dialog.
          </p>
          <button type="button" className="print-button" onClick={handlePrint}>
            Print or save as PDF
          </button>
        </aside>
        <section className="preview-surface">
          <DocumentPreview ref={previewRef} fragments={fragments} />
        </section>
      </div>
    </main>
  );
}
