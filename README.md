# Legal Drafting Preview

A Next.js starter that previews mixed Markdown and PDF fragments with a print-ready layout.

## Getting Started

```bash
npm install
npm run dev
```

## Features

- Render Markdown fragments with `react-markdown` + `remark-gfm`.
- Stream PDF pages with `@wojtekmaj/react-pdf` (PDF.js).
- Trigger browser print/save using `react-to-print`.
- Future-ready hook for assembling final PDFs via `pdf-lib`.
- Lax TypeScript and ESLint checks to keep Vercel builds unblocked by benign warnings.

## Structure

- `app/page.tsx` – top-level preview shell and print trigger.
- `app/components` – fragment renderers for Markdown and PDF content.
- `lib/demoFragments.ts` – sample dataset demonstrating mixed fragment rendering.

Replace the sample fragments with your own content and extend the PDF composition workflow when you're ready.
