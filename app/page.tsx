'use client';

import { useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';

import DocumentPreview from '@/components/DocumentPreview';
import type { DocumentAssembly } from '@/lib/documentTypes';
import { assemblePdf } from '@/lib/pdfAssembly';

const sampleAssembly: DocumentAssembly = {
  id: 'demo-assembly',
  title: 'Engagement Letter – Draft',
  fragments: [
    {
      id: 'opening-md',
      type: 'markdown',
      content: `# Engagement Letter\n\nDear Client,\n\nThank you for choosing **Acme Legal**. This engagement letter outlines the scope of representation and the key responsibilities for both parties.\n\n> _"Clarity is the foundation of every good agreement."_\n\n---`
    },
    {
      id: 'scope-md',
      type: 'markdown',
      content: `## Scope of Work\n\nWe will provide the following services:\n\n- Initial consultation and fact gathering.\n- Drafting of required pleadings.\n- Negotiation with counterparties.\n- Court appearances as required.\n\n### Deliverable timeline\n\n| Milestone | Owner | Target date |\n| --- | --- | --- |\n| Discovery plan | Acme Legal | 2024-06-14 |\n| Draft complaint | Acme Legal | 2024-06-28 |\n| Client approval | Client | 2024-07-05 |\n\nPlease review and check each item once it is complete:\n\n- [x] Engagement letter drafted\n- [ ] Client feedback incorporated\n- [ ] Final signature`
    },
    {
      id: 'legacy-terms-pdf',
      type: 'pdf',
      src: '/docs/legacy-terms.pdf',
      label: 'Legacy terms (PDF placeholder)'
    }
  ]
};

export default function HomePage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [assembly] = useState<DocumentAssembly>(sampleAssembly);
  const [assemblyStatus, setAssemblyStatus] = useState<string | null>(null);

  const fragments = useMemo(() => assembly.fragments, [assembly.fragments]);

  const handlePrint = useReactToPrint({
    documentTitle: assembly.title,
    content: () => previewRef.current
  });

  const handleAssemblePdf = async () => {
    setAssemblyStatus('Preparing compiled PDF (stub)…');
    try {
      await assemblePdf(assembly);
      setAssemblyStatus('PDF compilation succeeded. (Replace stub with pdf-lib integration.)');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setAssemblyStatus(`PDF compilation not ready: ${message}`);
    }
  };

  return (
    <main>
      <section className="preview-shell">
        <header className="preview-controls">
          <div>
            <h1 style={{ margin: 0 }}>{assembly.title}</h1>
            <p style={{ margin: '0.25rem 0 0', color: '#475569' }}>
              Mix Markdown and PDF fragments, paginate them, and print directly from your browser.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={handlePrint}>
              Print / Save as PDF
            </button>
            <button type="button" onClick={handleAssemblePdf}>
              Compile with pdf-lib (stub)
            </button>
          </div>
        </header>

        <DocumentPreview ref={previewRef} fragments={fragments} />

        {assemblyStatus ? (
          <div style={{ background: '#eef2ff', borderRadius: '0.75rem', padding: '1rem', color: '#3730a3' }}>
            {assemblyStatus}
          </div>
        ) : null}

        <aside style={{ fontSize: '0.9rem', color: '#64748b' }}>
          <strong>Tip:</strong> Drop a PDF named <code>legacy-terms.pdf</code> into <code>public/docs</code> to see the live
          PDF preview alongside the Markdown content. The placeholder message disappears once the PDF loads.
        </aside>
      </section>
    </main>
  );
}
