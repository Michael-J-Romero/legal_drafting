# Legal Drafting Preview

React + Next.js scaffolding for a live, paginated print preview that combines Markdown and PDF fragments.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) to see the preview.

### Adding PDF Fragments

Drop any sample PDF into the `public/` directory and update the fragment list in `src/app/page.tsx` (or load fragments from your data source) with an entry like:

```ts
{
  id: "existing-agreement",
  kind: "pdf",
  content: "/existing-agreement.pdf"
}
```

`react-pdf` will stream the file and render it page-by-page next to your Markdown fragments. Use the **Print / Save PDF** button to trigger the browser's native printing flow.

### Compiled PDF (future work)

The `compileFragmentsToPdf` helper in `src/lib/pdfAssembler.ts` is currently a stub that returns an empty PDF document. Replace it with server-side logic when you are ready to merge original PDF pages and rendered Markdown output.
