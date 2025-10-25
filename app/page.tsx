'use client';

import { useMemo } from 'react';
import DocumentRenderer from '@/components/DocumentRenderer';
import type { DocumentFragment } from '@/lib/types';

export default function HomePage() {
  const fragments = useMemo<DocumentFragment[]>(
    () => [
      {
        id: 'intro-markdown',
        type: 'markdown',
        content: `# Sample Legal Brief\n\nThis preview demonstrates **GitHub-flavored Markdown** rendering.\n\n- Bullet lists\n- Tables\n- Checklists\n\n| Clause | Summary |\n| --- | --- |\n| 1 | Provide context. |\n| 2 | Outline obligations. |\n\n> Quotes, callouts, and inline code like \`const foo = "bar";\`.\n\n---\n\n- [x] Draft introduction\n- [ ] Attach supporting PDF exhibits`,
      },
    ],
    [],
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Legal Drafting Previewer</h1>
          <p className="max-w-2xl text-base text-slate-600">
            Feed Markdown or PDF fragments to build a print-ready dossier. Use the print
            action to export via your browser, or extend the PDF compilation pipeline
            in <code>lib/pdfCompiler.ts</code> when you are ready.
          </p>
        </header>

        <DocumentRenderer fragments={fragments} />
      </div>
    </main>
  );
}
