import { useCallback, useMemo, useRef, useState } from 'react';
import ReactToPrint from 'react-to-print';
import { Fragment } from './types/fragments';
import FragmentRenderer from './components/FragmentRenderer';
import { compileFragmentsToPdf } from './utils/pdfCompilation';
import samplePdf from './assets/sample.pdf?url';
import './App.css';

const App = () => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const fragments = useMemo<Fragment[]>(
    () => [
      {
        id: 'introduction',
        kind: 'markdown',
        label: 'Executive Summary',
        content: `# Legal Draft Overview\n\nThis preview stitches **Markdown** and original **PDF** content into a single printable stream.\n\n## Key Features\n\n- Uses GitHub-flavoured Markdown for predictable formatting\n- Streams source PDFs with selectable text layers\n- Supports browser-native \"Print / Save as PDF\"\n\n> Tip: Resize the window to see how content reflows before printing.`
      },
      {
        id: 'table',
        kind: 'markdown',
        label: 'Clause Matrix',
        content: `| Clause | Status | Owner |\n| ------ | ------ | ----- |\n| Payment Terms | ✅ Final | Finance |\n| Confidentiality | ✏️ Drafting | Legal Ops |\n| Service Levels | ⚠️ Blocked | Product |`
      },
      {
        id: 'embedded-pdf',
        kind: 'pdf',
        label: 'Legacy Contract Excerpt',
        source: samplePdf
      },
      {
        id: 'closing-notes',
        kind: 'markdown',
        label: 'Closing Notes',
        content:
          `## Next Steps\n\n1. Review outstanding clauses.\n2. Export a consolidated PDF using the **Compile PDF** action.\n3. Circulate for signatures.\n\n---\n\nNeed bespoke pagination? Integrate **Paged.js** for advanced rules.`
      }
    ],
    []
  );

  const handleCompile = useCallback(async () => {
    try {
      setIsCompiling(true);
      setProgress('Preparing document...');
      const bytes = await compileFragmentsToPdf(fragments, setProgress);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'compiled-preview.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setProgress('Compilation complete!');
    } catch (error) {
      console.error(error);
      setProgress('Something went wrong while compiling.');
    } finally {
      setIsCompiling(false);
      setTimeout(() => setProgress(null), 4000);
    }
  }, [fragments]);

  return (
    <main>
      <header className="header">
        <div>
          <h1>Legal Drafting Preview</h1>
          <p className="subtitle">
            Render Markdown + PDF fragments into a live, printable story. Use the actions below to
            print or download a merged PDF.
          </p>
        </div>
        <div className="cta-group">
          <ReactToPrint
            trigger={() => (
              <button type="button" className="action-button secondary">
                Print / Save as PDF
              </button>
            )}
            content={() => previewRef.current}
          />
          <button
            type="button"
            className="action-button primary"
            onClick={handleCompile}
            disabled={isCompiling}
          >
            {isCompiling ? 'Compiling…' : 'Compile PDF'}
          </button>
        </div>
      </header>

      {progress ? <p className="progress">{progress}</p> : null}

      <div className="preview-surface" ref={previewRef}>
        {fragments.map((fragment) => (
          <FragmentRenderer key={fragment.id} fragment={fragment} />
        ))}
      </div>
    </main>
  );
};

export default App;
