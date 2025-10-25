import type { Fragment } from './fragmentTypes';

export const demoFragments: Fragment[] = [
  {
    id: 'cover',
    type: 'markdown',
    content: `# Legal Drafting Preview\n\nThis workspace stitches together **Markdown** and external **PDF** sources into a single printable document.\n\n- Edit the Markdown fragment in \`demoFragments.ts\`\n- Swap the sample PDF URL for one of your own when you're ready\n- Use the print button to trigger browser print or save as PDF\n`
  },
  {
    id: 'sample-pdf',
    type: 'pdf',
    src: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    title: 'Sample PDF (remote)'
  },
  {
    id: 'closing',
    type: 'markdown',
    content: `## Next Steps\n\n1. Replace the placeholder PDF with production-ready documents.\n2. Implement pdf-lib composition to merge the rendered fragments.\n3. Fine tune page-level styling with CSS Paged Media rules.\n`
  }
];
