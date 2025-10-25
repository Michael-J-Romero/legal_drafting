# Legal Drafting Preview

A Vite + React playground that stitches Markdown fragments and PDF documents into a single, printable narrative. It powers a live print preview, lets you trigger the browser's native **Print / Save as PDF**, and can compile a merged PDF using [`pdf-lib`](https://pdf-lib.js.org/).

## Features

- **Mixed fragment support** – render GitHub-flavoured Markdown alongside embedded PDFs with selectable text layers powered by [`react-pdf`](https://github.com/wojtekmaj/react-pdf).
- **Print preview fidelity** – preview surface mirrors how the document will appear when printed, with CSS page-break helpers.
- **One-click printing** – uses [`react-to-print`](https://www.npmjs.com/package/react-to-print) to call the browser's native print dialog.
- **PDF compilation** – merges original PDF fragments losslessly and converts Markdown fragments into new pages using [`pdf-lib`](https://pdf-lib.js.org/).

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) to view the preview interface.

Use the **Compile PDF** button to generate a merged file containing all Markdown and PDF fragments.

## Project structure

```
src/
  App.tsx                # Page composition + actions
  components/
    FragmentRenderer.tsx # Renders Markdown & PDF fragments with pagination helpers
  utils/pdfCompilation.ts# Converts fragment array into a single PDF
```

## Roadmap ideas

- Support for custom headers/footers with running text.
- Advanced pagination rules via [Paged.js](https://pagedjs.org/).
- Richer Markdown-to-PDF rendering (tables, checklists) using HTML-to-PDF pipelines.
