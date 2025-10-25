# Legal Drafting Preview

React + Next.js workspace for assembling printable documents from Markdown and PDF fragments.

## Features

- **Mixed fragment rendering** – preview Markdown (via `react-markdown` + `remark-gfm`) and PDF pages (`react-pdf`).
- **Print ready** – trigger the browser print dialog with `react-to-print` and preserve pagination styles.
- **PDF compilation stub** – `pdf-lib` placeholder ready for future high-fidelity exports.
- **Extensible architecture** – clean separation between fragment definitions, preview components, and export utilities.

## Getting started

```bash
npm install
npm run dev
```

> Packages are declared in `package.json`, but they are not installed in this environment.

Visit `http://localhost:3000` after starting the dev server. Add your own PDF file at `public/docs/legacy-terms.pdf` to see the PDF preview render next to the Markdown content.

## Next steps

- Implement `assemblePdf` in `lib/pdfAssembly.ts` using `pdf-lib` once ready to generate combined PDFs.
- Add persistence (e.g., API routes or external storage) for dynamic fragment arrays.
- Introduce richer pagination rules using tools like `Paged.js` if advanced control is needed.
