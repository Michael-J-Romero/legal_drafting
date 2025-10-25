# Legal Drafting Preview

This project bootstraps a Next.js + React workspace for rendering legal drafting artifacts from mixed Markdown and PDF fragments.

## Getting Started

```bash
npm install
npm run dev
```

The example home page loads a predefined set of fragments. Add a PDF named `sample.pdf` inside `public/pdfs/` to see PDF rendering alongside Markdown content.

## Available Scripts

- `npm run dev` – start the Next.js development server.
- `npm run build` – build the production bundle.
- `npm run start` – run the production server after building.
- `npm run lint` – lint the project with ESLint.
- `npm run typecheck` – run TypeScript without emitting files.

## Libraries

- [`react-markdown`](https://github.com/remarkjs/react-markdown) with `remark-gfm` for GitHub-flavored Markdown support.
- [`react-pdf`](https://github.com/wojtekmaj/react-pdf) layered on top of Mozilla PDF.js for on-screen PDF previews.
- [`react-to-print`](https://github.com/gregnb/react-to-print) to trigger the browser print dialog.
- [`pdf-lib`](https://pdf-lib.js.org/) for future high-fidelity PDF compilation workflows.

The scaffold focuses on rendering and print preview. PDF generation/merging is intentionally deferred.
