import { PreviewPlayground } from "@/components/preview/PreviewPlayground";
import type { DocumentConfig } from "@/lib/fragments";

const exampleDocument: DocumentConfig = {
  id: "example-document",
  title: "Draft Employment Agreement",
  fragments: [
    {
      id: "markdown-intro",
      kind: "markdown",
      content: `# Employment Agreement\n\n**Effective Date:** July 1, 2024\n\n## Parties\n\n- **Employer:** Example Legal Corp.\n- **Employee:** Jane Doe\n\n## Summary\n\nThis short sample demonstrates rendering Markdown next to placeholder PDF pages.\n\n- Markdown uses GitHub-flavoured syntax.\n- Tables, checklists, and inline HTML are available when needed.\n\n> Tip: Replace this content with any markdown fragment array returned by your editor workflow.\n`,
    },
    {
      id: "pdf-placeholder",
      kind: "pdf",
      src: "",
      label: "Executed signature packet",
    },
  ],
};

export default function HomePage() {
  return (
    <main>
      <PreviewPlayground document={exampleDocument} />
    </main>
  );
}
