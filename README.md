This project creates printable legal packets with pages sized precisely for clean Print Preview and paper output. It focuses on correct page dimensions, margins, headers/footers, and controlled page breaks so documents render exactly as intended when printed to Letter or A4.

## Copilot instructions (project intent)

- Goal: Generate UIs and print styles that produce perfectly sized pages for legal packet PDFs and browser Print Preview.
- Page size: default to US Letter (8.5in × 11in); support A4 (210mm × 297mm) via a toggle or build-time option.
- Print CSS: use `@media print` and `@page` with explicit size and margins (e.g., `@page { size: 8.5in 11in; margin: 1in; }`). Avoid unexpected scaling by the browser.
- Page breaks: use `break-before`, `break-after`, and `break-inside: avoid;` to control section boundaries; provide utility classes for consistent page breaks.
- Screen vs print: pages can scroll on screen, but ensure a 1:1 mapping to printed pages; add a print preview mode that shows page outlines on screen.
- Assets: any static example packets or templates should live under `public/pdfs/`.
- Testing: validate in Chrome Print Preview at 100% scale with headers/footers disabled (unless explicitly designed). Check both Letter and A4.

If generating code:
- Include a print stylesheet (global or page-level) and keep screen styles separate.
- Prefer pure CSS for pagination; only use JS to enhance preview (e.g., page outlines, toggles).
- Provide semantic HTML for legal sections; keep text scalable and selectable.
- Document assumptions (page size, margins) in component props or README comments.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the landing page by modifying `app/page.jsx` (Next.js App Router). The page auto-updates as you edit the file.

### Print-focused local checks

1. Open the main packet page, then File → Print (or Ctrl/Cmd+P).
2. Set Scale to 100% (no fit-to-page), disable browser headers/footers unless designed.
3. Confirm each page aligns with the visible page outlines (if preview mode is implemented).
4. Switch paper size between Letter and A4 to validate layout.

This project may use [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) for typography. Choose legible, print-friendly fonts with good metrics (e.g., Georgia, Times, or Geist Serif if appropriate) and specify print-safe fallbacks.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
