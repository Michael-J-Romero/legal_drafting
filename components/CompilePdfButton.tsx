'use client';

import { useState } from 'react';
import type { DocumentFragment } from '@/types/document';
import { compileFragmentsToPdf } from '@/lib/pdf/merge';

interface CompilePdfButtonProps {
  fragments: DocumentFragment[];
  className?: string;
  buttonClassName?: string;
  statusClassName?: string;
}

export function CompilePdfButton({
  fragments,
  className,
  buttonClassName,
  statusClassName
}: CompilePdfButtonProps) {
  const [isCompiling, setIsCompiling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleCompile = async () => {
    setIsCompiling(true);
    setStatus(null);

    try {
      const pdfBytes = await compileFragmentsToPdf(fragments);
      setStatus(`Compiled preview to PDF with ${pdfBytes.byteLength.toLocaleString()} bytes.`);
    } catch (error) {
      setStatus('Unable to compile PDF in this environment. Check console for details.');
      console.error(error);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className={className}>
      <button type="button" onClick={handleCompile} disabled={isCompiling} className={buttonClassName}>
        {isCompiling ? 'Compiling…' : 'Compile with pdf-lib (preview)'}
      </button>
      {status && <p className={statusClassName}>{status}</p>}
    </div>
  );
}
