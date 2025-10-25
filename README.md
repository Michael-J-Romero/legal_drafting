# Legal Drafting Preview

A Next.js starter that demonstrates the core building blocks for a legal drafting tool with high-fidelity print previews. The interface accepts an ordered list of Markdown and PDF fragments, renders them side-by-side, and exposes a print trigger that mirrors the browser's native "Print / Save as PDF" flow.

## Features

- **Markdown Rendering** — GitHub-flavored Markdown via [`react-markdown`](https://github.com/remarkjs/react-markdown) and `remark-gfm`.
- **PDF Preview** — Client-side PDF rendering powered by [`react-pdf`](https://github.com/wojtekmaj/react-pdf) (PDF.js under the hood).
- **Print to PDF** — Browser-native print dialog via [`react-to-print`](https://github.com/gregnb/react-to-print).
- **PDF Assembly Scaffold** — Utilities backed by [`pdf-lib`](https://pdf-lib.js.org/) for future high-fidelity PDF compilation.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) to view the preview.

3. Toggle the "Include placeholder PDF fragment" checkbox. Because no PDF assets are bundled yet, you'll see the graceful error state rendered by the PDF preview.

## Project Structure

```
app/
  components/
    DocumentPreview.tsx     ← orchestrates Markdown + PDF fragment rendering
    MarkdownPreview.tsx     ← Markdown renderer (react-markdown + remark-gfm)
    PdfPreview.tsx          ← Lazy-loads react-pdf for per-page preview
    PrintControls.tsx       ← Wraps react-to-print for a single entry point
  layout.tsx
  page.tsx                  ← Example page that wires the components together
lib/
  pdfAssembler.ts           ← pdf-lib scaffolding for future PDF merges
```

## Next Steps

- Add real PDF assets under `public/` and update fragment definitions to point at them.
- Implement Markdown-to-PDF rendering in `lib/pdfAssembler.ts` (e.g., via `paged.js` or headless Chromium) before merging with existing PDFs.
- Extend pagination controls with [`Paged.js`](https://pagedjs.org/) if more advanced page rules are required.
