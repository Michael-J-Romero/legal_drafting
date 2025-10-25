import type { DocumentFragment } from "@/lib/documentTypes";

export const sampleFragments: DocumentFragment[] = [
  {
    id: "introduction",
    type: "markdown",
    content: `# Engagement Letter\n\nThank you for choosing **Acme Legal Partners**. This preview combines Markdown notes with embedded PDFs to mirror the final packet.\n\n- Markdown fragments support [links](https://example.com)\n- Tables, task lists, and callouts render via remark-gfm\n- The layout is optimized for clean browser printing`
  },
  {
    id: "terms",
    type: "markdown",
    content: `## Scope of Services\n\n| Service | Included |\n| --- | --- |\n| Contract drafting | ✅ |\n| Regulatory review | ✅ |\n| Court representation | ❌ |\n\n> **Note:** Attachments can be reordered or replaced with finalized exhibits.`
  },
  {
    id: "exhibit-a",
    type: "pdf",
    src: "/sample.pdf",
    title: "Prior Filing"
  }
];
