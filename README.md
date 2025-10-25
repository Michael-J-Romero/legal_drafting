# Legal Drafting Print Previeww

A React + Vite starter that stitches Markdown and PDF fragments into a live print preview. It demonstrates:

- Rendering Markdown with GitHub-flavored Markdown (tables, callouts, checklists) via `react-markdown` and `remark-gfm`.
- Embedding PDFs page-by-page with selectable text using `react-pdf`.
- Invoking the browser's print / save as PDF dialog by wrapping the preview with `react-to-print`.
- Compiling the source fragments into a single, shareable PDF using `pdf-lib`.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173/.

> **Note**: If your environment restricts access to npm, you can install dependencies using an internal registry that mirrors the packages listed in `package.json`.

## Commands

- `npm run dev` – start the Vite dev server.
- `npm run build` – type-check and build a production bundle.
- `npm run preview` – preview the production build locally.

## Architecture overview

- `src/App.tsx` orchestrates the UI, showing the toolbar, document outline, and preview.
- `src/components/DocumentPreview.tsx` paginates fragments and delegates to fragment-specific renderers.
- `src/components/MarkdownFragment.tsx` renders Markdown with GitHub-style features.
- `src/components/PdfFragment.tsx` renders PDF fragments using PDF.js under the hood.
- `src/hooks/usePrintHandler.ts` wraps `react-to-print` to open the browser print dialog.
- `src/hooks/useCompiledPdf.ts` merges Markdown and PDF fragments into a single PDF with `pdf-lib`.
- `src/lib/sampleFragments.ts` provides sample data; replace with your own ordered fragments in production.

Styling lives in `src/styles/` with CSS tuned for screen preview and print output.
