# Legal Drafting Preview

A Next.js + React toolkit for building live, paginated previews that mix Markdown fragments and PDF pages. The app scaffolds future features like high-fidelity PDF compilation with [pdf-lib](https://pdf-lib.js.org/) while providing a polished Markdown preview out of the box.

## Features

- 📄 **Paginated preview** that mirrors browser print layout using simple CSS paged-media rules.
- ✍️ **Markdown rendering** powered by `react-markdown` and `remark-gfm` for GitHub-flavoured tables, checklists, and more.
- 📑 **PDF fragment support** wired through `react-pdf` (Mozilla PDF.js) with a client-only viewer.
- 🖨️ **One-click print** via `react-to-print`, ready for native Print / Save as PDF workflows.
- 🧱 **Compilation scaffold** that prepares for merging Markdown-rendered pages with existing PDFs through `pdf-lib`.

## Getting started

Install dependencies and run the local dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the preview UI.

> **Note:** A network connection is required for `npm install`. If dependencies cannot be downloaded (e.g., in a sandboxed environment), install them when you have network access.

## Working with fragments

Fragments are defined in [`types/fragments.ts`](types/fragments.ts) and consumed by [`app/page.tsx`](app/page.tsx).

- **Markdown** fragments render immediately using GitHub-flavoured Markdown support.
- **PDF** fragments expect a `src` that points to a file under `public/` or a remote URL.

Example snippet:

```ts
const fragments: Fragment[] = [
  { id: 'intro', type: 'markdown', content: '# Title' },
  { id: 'appendix', type: 'pdf', src: '/contracts/example.pdf' },
];
```

## Printing

Click **“Print / Save as PDF”** to open the browser print dialog. Only the preview surface is included in the printable area thanks to the scoped print styles in [`app/globals.css`](app/globals.css).

## Roadmap

- Render Markdown fragments to PDF pages and merge with imported PDFs using `pdf-lib`.
- Provide richer layout controls (headers/footers, page numbering) possibly via `Paged.js` or custom CSS.
- Add automated tests covering Markdown edge cases and PDF pagination.
