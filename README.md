# Legal Drafting Preview

Scaffolding for a Next.js application that assembles legal drafting fragments into a paginated print preview.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 to interact with the sample preview. The sample document mixes Markdown content and an external PDF to demonstrate the rendering pipeline.

## Key libraries

- **react-markdown** + **remark-gfm** render Markdown fragments safely inside the preview surface.
- **react-pdf** streams full PDF pages into React and mirrors print pagination.
- **react-to-print** delegates exporting to the browser’s print dialog.
- **pdf-lib** is wired into `lib/pdf/merge.ts` for future high-fidelity PDF compilation.

## Next steps

- Replace the placeholder fragment data in `app/page.tsx` with live content.
- Implement Markdown-to-PDF rendering before feeding Markdown fragments into the `compileFragmentsToPdf` helper.
- Persist compiled PDFs or stream them to a backend service as needed.
