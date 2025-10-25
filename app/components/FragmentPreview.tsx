'use client';

import { Fragment, isMarkdownFragment, isPdfFragment } from '../../lib/fragmentTypes';
import { MarkdownFragment } from './MarkdownFragment';
import dynamic from 'next/dynamic';

const PdfFragment = dynamic(() => import('./PdfFragment').then((mod) => mod.PdfFragment), {
  ssr: false,
  loading: () => <div className="pdf-fragment__loading">Loading PDF fragment…</div>
});

type Props = {
  fragments: Fragment[];
};

export function FragmentPreview({ fragments }: Props) {
  return (
    <div className="preview-stack">
      {fragments.map((fragment) => {
        if (isMarkdownFragment(fragment)) {
          return <MarkdownFragment key={fragment.id} fragment={fragment} />;
        }

        if (isPdfFragment(fragment)) {
          return <PdfFragment key={fragment.id} fragment={fragment} />;
        }

        return null;
      })}
    </div>
  );
}
