import { DocumentPreview } from '@/components/DocumentPreview';
import type { DocumentFragment } from '@/types/document';

const SAMPLE_FRAGMENTS: DocumentFragment[] = [
  {
    id: 'cover-letter',
    type: 'markdown',
    content: `# Memorandum of Understanding\n\n**Prepared for:** Example Client\n\n**Prepared by:** Legal Drafting Studio\n\n**Date:** ${new Date().toLocaleDateString()}\n\n---\n\n## Purpose\n\nThis preview demonstrates how Markdown content can be combined with whole PDF files in a single, paginated experience.\n\n- Rich text\n- Tables\n- Task lists\n\n| Task | Owner | Due Date |\n| --- | --- | --- |\n| Draft engagement letter | Alex | 2025-10-30 |\n| Review prior agreements | Jamie | 2025-11-02 |`
  },
  {
    id: 'supporting-pdf',
    type: 'pdf',
    src: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    label: 'Sample Exhibit'
  },
  {
    id: 'closing-remarks',
    type: 'markdown',
    content: `## Next steps\n\n1. Replace these sample fragments with live data.\n2. Use the \"Print / Save as PDF\" control above to export this combined preview.\n3. Wire up the pdf-lib merge helper to produce a high-fidelity compiled PDF.\n\n> Tip: Keep Markdown sections concise so they paginate cleanly alongside imported PDFs.`
  }
];

export default function HomePage() {
  return (
    <main>
      <div className="container">
        <DocumentPreview fragments={SAMPLE_FRAGMENTS} />
      </div>
    </main>
  );
}
