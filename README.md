# Legal Drafting Preview

A Next.js sandbox for orchestrating Markdown and PDF fragments into a unified, print-friendly experience.

## Getting started

```bash
npm install
npm run dev
```

> **Note**
> TypeScript and ESLint checks are intentionally non-blocking for rapid iteration. The production build will only fail on runtime-breaking issues.

## Key capabilities

- Render Markdown with [`react-markdown`](https://github.com/remarkjs/react-markdown) and [`remark-gfm`](https://github.com/remarkjs/remark-gfm)
- Inline PDF preview through [`react-pdf`](https://github.com/wojtekmaj/react-pdf)
- Trigger native browser printing with [`react-to-print`](https://github.com/gregnb/react-to-print)
- Future-ready PDF assembly helpers powered by [`pdf-lib`](https://pdf-lib.js.org/)
- Optional CSS paged-media extensions provided by [`pagedjs`](https://pagedjs.org/)

## Project layout

- `app/` – App Router entry points and global styles
- `components/preview/` – Building blocks for rendering Markdown and PDF fragments
- `hooks/usePrint.ts` – Thin wrapper around `react-to-print`
- `lib/pdfAssembler.ts` – Async helper ready for high-fidelity PDF compilation
- `types/fragments.ts` – Shared TypeScript contracts for fragment data
- `public/sample.pdf` – Minimal single-page PDF used in the sandbox

## Next steps

- Plug in your own content pipeline (remote Markdown, uploaded PDFs, etc.)
- Extend `assemblePdfFromFragments` to merge PDF and rendered Markdown pages
- Experiment with `pagedjs` if you need richer pagination controls
