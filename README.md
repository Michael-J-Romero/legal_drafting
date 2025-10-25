# Legal Drafting Preview

This project bootstraps a Next.js application focused on assembling Markdown and PDF fragments into a print-ready experience.

## Key Features

- **Markdown preview** using `react-markdown` with GitHub-flavoured Markdown support via `remark-gfm`.
- **PDF preview scaffolding** powered by `react-pdf`. The worker is configured lazily so you can drop in PDF assets later without breaking builds.
- **Print trigger** wired with `react-to-print` to call the browser's native print dialog.
- **Future PDF assembly** support prepared with `pdf-lib` and optional paginated layout enhancements via `pagedjs`.
- **Lax linting and type-checking** so benign warnings never block your Vercel builds. Adjust `next.config.mjs` if you want stricter checks.

## Getting Started

```bash
npm install
npm run dev
```

The home page contains a playground rendering Markdown immediately and a placeholder slot where PDFs will appear after you supply document sources.

## Project Layout

- `app/` – Next.js app router entry points and global styles.
- `components/preview/` – Fragment renderers and preview shell.
- `components/printing/` – Hooks for invoking the browser print dialog.
- `components/providers/` – Optional providers such as Paged.js integration.
- `lib/` – Shared types and configuration helpers.

## Next Steps

- Replace the sample data in `app/page.tsx` with your real fragment pipeline.
- Provide local or remote PDF URLs for fragments that should render via `react-pdf`.
- Extend the `PagedPreviewProvider` once you need richer paged-media layout rules.
- Use `pdf-lib` to compose a single distributable PDF when you are ready to implement export logic.
