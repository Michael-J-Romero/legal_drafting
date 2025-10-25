# Legal Drafting Previewer

A Next.js proof of concept for assembling legal documents from Markdown and PDF fragments into a print-friendly experience.

## Getting Started

```bash
npm install
npm run dev
```

If package installation is blocked in your environment, configure an npm proxy or install dependencies offline before running the dev server.

## Key Features

- Live Markdown rendering with GitHub-flavored markdown via `react-markdown` and `remark-gfm`.
- PDF preview scaffolding powered by `react-pdf` with pagination helpers ready for `pagedjs`.
- Print action that uses `react-to-print` to invoke the browser print dialog.
- Future-proofed `lib/pdfCompiler.ts` scaffold that merges PDF fragments using `pdf-lib` and leaves hooks for Markdown-to-PDF conversion.

## Lax Build Settings

The project intentionally ignores TypeScript and ESLint errors during production builds via `next.config.mjs`. Tighten these settings once the domain model stabilizes.
