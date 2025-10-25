import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import FragmentPreview from './components/FragmentPreview';
import FragmentForm from './components/FragmentForm';
import Toolbar from './components/Toolbar';
import type { Fragment } from './types/fragments';
import { compileFragmentsToPdf } from './utils/pdf';
import './App.css';

const SAMPLE_PDF_URL =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

const initialFragments: Fragment[] = [
  {
    id: 'markdown-intro',
    type: 'markdown',
    content: `# Engagement Overview\n\n- **Client:** Example Industries\n- **Matter:** Service agreement renewal\n- **Effective Date:** ${new Date().toLocaleDateString()}\n\n---\n\n## Objectives\n\n1. Capture business requirements and negotiating points.\n2. Produce a polished agreement ready for signature.\n3. Ensure distribution-ready PDF output with consistent pagination.`,
  },
  {
    id: 'pdf-sample',
    type: 'pdf',
    src: SAMPLE_PDF_URL,
    label: 'Sample Appendix.pdf',
  },
  {
    id: 'markdown-clauses',
    type: 'markdown',
    content: `## Key Clauses\n\n### 1. Services\n\nThe Provider shall deliver the Services described in *Schedule A*.\n\n### 2. Payment Terms\n\n| Milestone | Amount | Due Date |\n|-----------|--------|----------|\n| Kickoff   | $5,000 | Net 15   |\n| Delivery  | $7,500 | Net 15   |\n\n### 3. Acceptance\n\nAcceptance criteria must be met prior to final payment.`,
  },
];

type Status = { type: 'success' | 'error'; message: string } | null;

const App: React.FC = () => {
  const [fragments, setFragments] = useState<Fragment[]>(initialFragments);
  const [status, setStatus] = useState<Status>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  const handleAddFragment = useCallback((fragment: Fragment) => {
    setFragments((current) => [...current, fragment]);

    if (fragment.type === 'pdf' && fragment.src.startsWith('blob:')) {
      blobUrlsRef.current.add(fragment.src);
    }
  }, []);

  const handlePrint = useReactToPrint({
    content: () => previewRef.current,
    documentTitle: 'legal-drafting-preview',
  });

  const handleCompilePdf = useCallback(async () => {
    setStatus(null);
    setIsCompiling(true);

    try {
      const blob = await compileFragmentsToPdf(fragments);
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `legal-drafting-${new Date().toISOString().split('T')[0]}.pdf`;
      anchor.rel = 'noopener';
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      setStatus({ type: 'success', message: 'Compiled master PDF downloaded successfully.' });
    } catch (error) {
      console.error(error);
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to compile PDF. Please retry.',
      });
    } finally {
      setIsCompiling(false);
    }
  }, [fragments]);

  const statusClassName = useMemo(() => {
    if (!status) return 'app-status';
    return `app-status app-status--${status.type}`;
  }, [status]);

  return (
    <div className="app-shell">
      <Toolbar
        fragments={fragments}
        onPrint={handlePrint}
        onCompilePdf={handleCompilePdf}
        isCompiling={isCompiling}
      />
      <FragmentForm onAddFragment={handleAddFragment} />
      {status && <div className={statusClassName}>{status.message}</div>}
      <div className="preview-container">
        <FragmentPreview ref={previewRef} fragments={fragments} />
      </div>
    </div>
  );
};

export default App;
