import type { Fragment } from './types';

const samplePdf =
  'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8L1R5cGUgL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZSAvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL0NvbnRlbnRzIDQgMCBSL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA1IDAgUj4+Pj4+PgplbmRvYmoKNCAwIG9iago8PC9MZW5ndGggNzY+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3NTAgVGQKKExlZ2FsIERyYWZ0aW5nIFByZXZpZXcgU2FtcGxlKSBUMgowIDcwMCBUZAooVGhpcyBpcyBhIHNhbXBsZSBwYWdlIGluIGFuIGVtYmVkZGVkIFBERi4pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PC9UeXBlIC9Gb250L1N1YnR5cGUgL1R5cGUxL05hbWUgL0YxL0Jhc2VGb250IC9IZWx2ZXRpY2EvRW5jb2RpbmcgL0lTTzU4OS0xPj4KZW5kb2JqCnhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDExMCAwMDAwMCBuIAowMDAwMDAwMDYzIDAwMDAwIG4gCjAwMDAwMDAxMTggMDAwMDAgbiAKMDAwMDAwMDIzNiAwMDAwMCBuIAowMDAwMDAwMzQyIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA3L1Jvb3QgMSAwIFIvSW5mbyA2IDAgUi9JRCBbPDAzQkIzNkNEQ0Y2MTY0OUUwRjcyOTk5NEEyNUE4RjhFPjwzQkIzNkNEQ0Y2MTY0OUUwRjcyOTk5NEEyNUE4RjhFPj5dPj4Kc3RhcnR4cmVmCjQ0NAolJUVPRgo=';

export const sampleFragments: Fragment[] = [
  {
    id: 'intro',
    kind: 'markdown',
    title: 'Overview',
    markdown: `# Live Print Preview\n\nThis demo shows how Markdown and PDF fragments can be stitched together into a printable document.\n\n- Markdown fragments render with **GitHub-flavored markdown** support.\n- PDF fragments are embedded page-by-page.\n\n> Use the toolbar to print or download a compiled PDF.`,
  },
  {
    id: 'terms-pdf',
    kind: 'pdf',
    title: 'Embedded PDF',
    src: samplePdf,
  },
  {
    id: 'clauses',
    kind: 'markdown',
    title: 'Clauses',
    markdown: `## Clauses\n\n1. **Definitions.** Key terms are defined at the start of the agreement.\n2. **Obligations.** Each party commits to their respective duties.\n3. **Termination.** Either party may terminate with thirty (30) days notice.\n\n| Obligation | Owner | Due Date |\n| --- | --- | --- |\n| Draft statement of work | Legal | 2024-08-01 |\n| Review compliance | Operations | 2024-08-15 |\n| Final sign-off | Executive | 2024-08-30 |`,
  },
];
