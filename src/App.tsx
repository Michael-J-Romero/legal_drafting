import React, { useMemo, useRef, useState } from 'react';
import { sampleFragments } from './lib/sampleFragments';
import type { Fragment } from './lib/types';
import { DocumentPreview } from './components/DocumentPreview';
import { Toolbar } from './components/Toolbar';
import { usePrintHandler } from './hooks/usePrintHandler';
import { useCompiledPdf } from './hooks/useCompiledPdf';
import './styles/preview.css';
import './lib/pdfWorker';

function getFragmentSummary(fragment: Fragment) {
  if (fragment.kind === 'markdown') {
    const plain = fragment.markdown.replace(/[#>*`*_\-]/g, '');
    return plain.slice(0, 160).trim() + (plain.length > 160 ? '…' : '');
  }
  return 'PDF fragment';
}

function App() {
  const [fragments] = useState<Fragment[]>(() => sampleFragments);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const { handlePrint, isPrinting } = usePrintHandler(previewRef);
  const { compile, isCompiling } = useCompiledPdf();

  const summary = useMemo(
    () =>
      fragments.map((fragment) => ({
        id: fragment.id,
        title:
          fragment.title ?? (fragment.kind === 'markdown' ? 'Markdown fragment' : 'PDF fragment'),
        kind: fragment.kind,
        description: getFragmentSummary(fragment),
      })),
    [fragments],
  );

  const handleDownload = async () => {
    try {
      setError(null);
      const blob = await compile(fragments);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'legal-drafting-preview.pdf';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to compile PDF');
    }
  };

  return (
    <div className="preview-layout">
      <aside className="preview-sidebar">
        <Toolbar onPrint={handlePrint} onDownload={handleDownload} isPrinting={isPrinting} isCompiling={isCompiling} />
        <section className="toolbar">
          <h2 className="toolbar__title">Document outline</h2>
          <ol className="outline">
            {summary.map((item, index) => (
              <li key={item.id} className="outline__item">
                <span className="outline__index">{index + 1}</span>
                <div className="outline__content">
                  <span className="outline__title">{item.title}</span>
                  <span className="outline__meta">{item.kind === 'markdown' ? 'Markdown' : 'PDF'}</span>
                  <p className="outline__description">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
          {error ? <p className="outline__error">{error}</p> : null}
        </section>
      </aside>
      <main>
        <DocumentPreview ref={previewRef} fragments={fragments} />
      </main>
    </div>
  );
}

export default App;
