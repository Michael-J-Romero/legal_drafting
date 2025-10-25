# Legal Drafting Preview

A Next.js + React workspace that stitches Markdown fragments and PDF exhibits into a single, print-ready preview. The app is designed to mirror the browser's native "Print / Save as PDF" output so legal teams can confidently distribute polished packets.

## Features

- **Mixed fragments**: Accepts ordered Markdown and PDF fragment descriptors and renders them sequentially.
- **Markdown rendering**: Uses `react-markdown` with `remark-gfm` for GitHub-flavoured Markdown including tables and task lists.
- **PDF previews**: Integrates `react-pdf` for page-accurate previews with selectable text layers.
- **Print trigger**: `react-to-print` powers a one-click export via the browser's print dialog.
- **Extensible PDF pipeline**: `pdf-lib` is included for future work to merge generated content with source PDFs without lossy conversions.

## Getting started

Because the execution environment for this template does not allow installing npm packages, dependencies are declared but not yet installed. In your local environment:

```bash
npm install
npm run dev
```

Then visit `http://localhost:3000` to view the preview workspace. The sample data lives in `lib/sampleFragments.ts` and demonstrates how Markdown and PDF fragments are combined.

## Project structure

- `app/` – Next.js App Router entrypoints and global styles.
- `components/DocumentPreview.tsx` – Renders the mixed fragment stream with Markdown and PDF preview support.
- `hooks/usePrint.ts` – Reusable hook that wraps `react-to-print` for exporting the preview container.
- `lib/` – Shared types and sample data.
- `public/sample.pdf` – Lightweight example PDF used in the demo.

## Next steps

- Wire up real data sources for fragments and pagination rules.
- Implement `pdf-lib` powered compilation to merge original PDFs with rendered Markdown output.
- Expand pagination controls or adopt [Paged.js](https://pagedjs.org/) if richer print CSS features are required.
- Add automated tests and CI once package installation is available.
