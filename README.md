# Legal Drafting Preview

A React + Vite application for composing legal document packages from a mixture of Markdown fragments and PDFs. The interface provides a paginated preview that mirrors browser print output, supports one-click printing via the native dialog, and can merge the source fragments into a single distribution-ready PDF.

## Features

- Live, print-like preview of Markdown and PDF fragments rendered in the document order.
- GitHub-flavored Markdown support (tables, checklists, etc.) via `react-markdown` and `remark-gfm`.
- High-fidelity PDF rendering with selectable text using `react-pdf` (PDF.js).
- Native print dialog integration powered by `react-to-print`.
- PDF compilation workflow that merges uploaded PDFs and Markdown-derived pages using `pdf-lib`.
- Editor utilities to append Markdown blocks or upload additional PDF fragments on the fly.

## Getting started

```bash
npm install
npm run dev
```

This launches the Vite dev server at <http://localhost:5173> with hot module reloading.

### Building for production

```bash
npm run build
npm run preview
```

The first command bundles the application to `dist/`, while the second serves the build locally for smoke testing.

## Implementation notes

- `src/components/FragmentPreview.tsx` orchestrates pagination and wraps fragment renderers for printability.
- `src/components/MarkdownPage.tsx` and `src/components/PdfPage.tsx` render Markdown and PDF assets respectively.
- `src/utils/pdf.ts` uses `pdf-lib` to combine fragments into a single downloadable PDF. Markdown content is converted to text blocks and paginated into standard letter-sized pages for predictable output.
- Remote PDFs must be accessible with permissive CORS headers to render inside the browser. Uploaded PDFs are stored as object URLs and automatically revoked when no longer needed.

## Roadmap

- Introduce drag-and-drop reordering of fragments.
- Add persisted workspaces backed by local storage or a backend service.
- Enhance Markdown-to-PDF rendering fidelity with rich typography and layout.
- Integrate automated pagination helpers (e.g., Paged.js) if advanced page rules are required.
