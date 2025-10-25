import PrintPreview from '@/components/PrintPreview';
import type { DocumentFragment } from '@/types/document';

const sampleFragments: DocumentFragment[] = [
  {
    id: '001-markdown-intro',
    type: 'markdown',
    label: 'Project Introduction',
    content: `# Engagement Letter\n\nWelcome to the live drafting environment.\n\n- Mix Markdown narratives with existing PDF exhibits.\n- Print directly from the browser or compile later using pdf-lib.\n\n> This preview is paginated and ready for client delivery.`,
  },
  {
    id: '002-pdf-sample',
    type: 'pdf',
    label: 'Sample Exhibit',
    src: '/sample.pdf',
  },
  {
    id: '003-markdown-appendix',
    type: 'markdown',
    label: 'Appendix',
    content: `## Appendix A\n\n| Clause | Summary |\n| ------ | ------- |\n| 1 | Payment terms due net 30. |\n| 2 | Confidentiality survives termination. |\n\n- [x] Reviewed by counsel\n- [ ] Sent for signature`,
  },
];

export default function HomePage() {
  return <PrintPreview fragments={sampleFragments} />;
}
