# Legal Drafting Preview

A Next.js + React workspace for assembling legal documents from a mixture of Markdown fragments and
PDF attachments. The app offers a paginated preview that mirrors the browser's print layout,
Markdown rendering via GitHub-flavoured markdown, and scaffolding for future high-fidelity PDF
compilation.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the preview shell. The
sample fragments live in `app/page.tsx` and include Markdown blocks alongside a placeholder PDF
stored in `public/samples/example.pdf`.

## Printing and PDF Assembly

- Use the **Print / Save as PDF** button to invoke the browser's native print dialog via
  [`react-to-print`](https://www.npmjs.com/package/react-to-print).
- PDF previews are powered by [`react-pdf`](https://www.npmjs.com/package/react-pdf), which renders
  each page individually for high fidelity.
- Future work can leverage [`pdf-lib`](https://www.npmjs.com/package/pdf-lib) through the
  scaffolding in `lib/pdfAssembler.ts` to merge PDF fragments and rendered Markdown pages into a
  single distributable file.

TypeScript and ESLint checks are intentionally lax in `next.config.js` to avoid blocking deployments
with non-critical issues while the drafting workflow evolves.
