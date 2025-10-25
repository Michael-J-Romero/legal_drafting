import PreviewPlayground from "@/components/PreviewPlayground";
import type { ContentFragment } from "@/types/content";

const sampleFragments: ContentFragment[] = [
  {
    id: "intro",
    type: "markdown",
    label: "Project Overview",
    content: `# Draft Engagement Letter\n\nWelcome to the drafting workspace. This preview stitches together Markdown and PDF fragments to create a printable record.\n\n- Markdown supports **GitHub-flavored** extensions like tables and checklists.\n- PDFs render page-by-page alongside Markdown content.\n- Use the Print button to trigger the browser\'s \"Print / Save as PDF\" dialog.`,
  },
  {
    id: "sample-table",
    type: "markdown",
    label: "Checklist",
    content: `## Matter Intake Checklist\n\n| Task | Owner | Status |\n| --- | --- | --- |\n| Conflict check | Operations | [x] |\n| Engagement letter draft | Associate | [ ] |\n| Fee schedule approval | Partner | [ ] |`,
  },
  {
    id: "pdf-placeholder",
    type: "pdf",
    label: "Placeholder PDF",
    src: "/pdfs/sample.pdf",
    note: "Add a PDF named sample.pdf to public/pdfs to see it rendered here.",
  },
];

export default function HomePage() {
  return <PreviewPlayground initialFragments={sampleFragments} />;
}
