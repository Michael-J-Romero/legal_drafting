import { PrintPreview } from "@/components/PrintPreview";
import type { DocumentFragment } from "@/lib/fragments";

const sampleFragments: DocumentFragment[] = [
  {
    id: "cover",
    kind: "markdown",
    label: "Cover letter",
    content: `# Memorandum of Understanding

**Prepared for:** Example Client  
**Author:** Legal Ops Team  
**Date:** ${new Date().toLocaleDateString()}

---

## Overview

This demo shows how markdown content is rendered inside a paginated preview. You can:

- Write regular markdown with **strong** and _emphasized_ text.
- Create tables, task lists, and code blocks.
- Mix in existing PDF exhibits or appendices.

> Tip: Edit 'sampleFragments' in 'src/app/page.tsx' to experiment with different content.`
  },
  {
    id: "outline",
    kind: "markdown",
    label: "Working outline",
    content: `## Goals

1. Produce an easy-to-review draft.
2. Merge legacy PDF artifacts without reformatting them.
3. Print or export the entire packet as a clean PDF.

| Deliverable | Owner | Due |
| ----------- | ----- | --- |
| Draft outline | ✍️ Legal Ops | Complete |
| Collect exhibits | 📎 Paralegal | In progress |
| Client review | 🧑‍💼 Partner | Pending |

- [x] Draft cover letter
- [ ] Insert signed NDA PDF
- [ ] Export finalized packet`
  },
  {
    id: "placeholder-pdf",
    kind: "pdf",
    label: "Sample PDF exhibit",
    src: "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf"
  },
  {
    id: "next-steps",
    kind: "markdown",
    label: "Next steps",
    content: `## Next steps

When you are ready to wire in real data:

1. Replace the sample fragments with content from your CMS or database.
2. Use the 'assemblePdf' helper to produce a high-fidelity PDF bundle with pdf-lib.
3. Enable CSS paged media in browsers with the optional Paged.js hook.

### Need richer pagination?

Paged.js unlocks advanced selectors like '@page', running headers, and cross-references. Toggle it on by passing 'enablePagedPreview={true}' to the PrintPreview component.`
  }
];

export default function HomePage() {
  return (
    <main>
      <PrintPreview fragments={sampleFragments} />
    </main>
  );
}
