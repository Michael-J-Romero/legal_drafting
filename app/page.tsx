import DocumentPreview from '@/components/DocumentPreview';
import type { Fragment } from '@/types/fragments';

const sampleFragments: Fragment[] = [
  {
    id: 'cover',
    type: 'markdown',
    content: `# Legal Drafting Preview\n\nWelcome to the live print preview. This page demonstrates how Markdown content is rendered into paginated sheets.\n\n> Tip: Add your own fragments in \`app/page.tsx\` to experiment.\n\n- Markdown with **bold**, _italic_, and \`inline code\`.\n- Tables, task lists, and more are available via GitHub-flavoured Markdown.\n\n| Clause | Summary |\n| ------ | ------- |\n| 1.0 | Define parties involved in the agreement. |\n| 2.0 | Outline the scope of services. |\n`,
  },
  {
    id: 'terms',
    type: 'markdown',
    content: `## Section 1 — Engagement\n\nThe Firm agrees to provide the Client with timely drafts that reflect the negotiated business terms. Each draft will be circulated in PDF form and accompanied by a redline summary.\n\n## Section 2 — Review Cadence\n\n1. Weekly working sessions will be held every Tuesday.\n2. Urgent revisions may be requested with at least 24 hours notice.\n3. Final signature copies will be delivered after written acceptance.\n\n### Next steps\n\n- Add PDF fragments by pointing to files placed in \`public/\`.\n- Wire up the pdf-lib workflow when you are ready to compile a single distribution PDF.\n- Iterate on layout rules (headers/footers, page numbers) as your requirements grow.\n`,
  },
];

export default function HomePage() {
  return (
    <main>
      <header>
        <h1>Legal Drafting Toolkit</h1>
        <p>
          Mix Markdown fragments and uploaded PDFs into a paginated preview that mirrors browser
          printing and prepares for future one-click PDF compilation.
        </p>
      </header>
      <DocumentPreview fragments={sampleFragments} />
    </main>
  );
}
