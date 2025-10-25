# Legal Drafting Preview

A Next.js starter that assembles markdown and PDF fragments into a live print preview. The UI mirrors the browser's print layout and is ready for future PDF compilation workflows.

## Features

- ⚛️ **Next.js + React** application scaffolded for server components with client-side preview widgets.
- 📝 **Markdown rendering** via `react-markdown` and `remark-gfm` with GitHub-flavoured extras such as tables and checklists.
- 📄 **Embedded PDF previews** backed by `react-pdf` (PDF.js) so existing exhibits appear page-by-page.
- 🖨️ **One-click printing** with `react-to-print`, delegating to the browser's native Print / Save as PDF dialog.
- 🧩 **Composable fragments** describing markdown or PDF content for flexible ordering.
- 🧪 **Future-ready PDF assembly** helpers using `pdf-lib` to merge source PDFs with rendered markdown pages.
- 🧾 **Optional Paged.js hook** to experiment with paged-media CSS polyfills.

## Getting started

> **Note:** Dependencies are declared in `package.json` but not installed in this environment. Run the commands below locally to install packages before starting the dev server.

```bash
npm install
npm run dev
```

Then open http://localhost:3000 to view the live preview.

## Project structure

- `src/app/page.tsx` – Example page composing the preview with sample fragments.
- `src/components/` – UI building blocks for markdown, PDF, and print orchestration.
- `src/lib/fragments.ts` – Shared fragment types and guards.
- `src/lib/pdfAssembler.ts` – Scaffolding for merging fragments into a single PDF using `pdf-lib`.

## Working with fragments

Create an ordered list of fragments that mix markdown and PDFs:

```ts
import type { DocumentFragment } from "@/lib/fragments";

const fragments: DocumentFragment[] = [
  { id: "intro", kind: "markdown", content: "# Hello" },
  { id: "exhibit-a", kind: "pdf", src: "/exhibits/a.pdf" }
];
```

Pass the collection to the `PrintPreview` component to render them and expose a print trigger:

```tsx
<PrintPreview fragments={fragments} enablePagedPreview={process.env.NODE_ENV === "development"} />
```

## Compiling PDFs

Use the `assemblePdf` helper when you're ready to produce a downloadable bundle:

1. Provide a `loadPdfBytes` function that retrieves existing PDFs (e.g., `fetch` or filesystem read).
2. Supply a `renderMarkdownPage` function that turns markdown fragments into PDF bytes.
3. Call `assemblePdf({ fragments, loadPdfBytes, renderMarkdownPage })` and stream the resulting bytes to the client.

The implementation stubs are intentionally light-weight so you can integrate your preferred rendering pipeline (Playwright, headless Chrome, serverless jobs, etc.).

## Next steps

- Replace the remote sample PDF URL with your own asset served from `/public`.
- Persist fragment ordering in a database or content API.
- Expand styling, headers, and pagination rules as needed.
