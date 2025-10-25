import { PrintPreview } from "@/components/PrintPreview";
import type { DocumentFragment } from "@/lib/types";
import styles from "@/styles/HomePage.module.css";

const sampleFragments: DocumentFragment[] = [
  {
    id: "cover",
    kind: "markdown",
    content: `# Engagement Letter\n\n**Prepared for:** Example Client\\n**Prepared by:** Example Firm\n\n> This preview renders Markdown as it will appear when printed.\n`
  },
  {
    id: "scope",
    kind: "markdown",
    content: `## Scope of Representation\n\n- Draft and review proposed contract terms\n- Provide redlines and commentary\n- Coordinate with counterparties\n\n### Key Dates\n\n| Milestone | Target |\n| --- | --- |\n| Initial draft | May 5 |\n| Negotiation kickoff | May 12 |\n| Target signing | May 30 |`
  },
  {
    id: "next-steps",
    kind: "markdown",
    content: `## Next Steps\n\n1. Drop an existing PDF into \`public/\` and add a fragment with \`kind: "pdf"\` to preview it inline.\n2. Use **Print / Save PDF** to produce a polished packet directly from your browser.\n3. Implement the \`compileFragmentsToPdf\` helper when you are ready for server-side PDF assembly.`
  }
];

export default function HomePage() {
  return (
    <main className={styles.main}>
      <PrintPreview fragments={sampleFragments} />
    </main>
  );
}
