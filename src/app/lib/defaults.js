'use client';

// UI copy and defaults centralized here to keep page.jsx clean

export const DEFAULT_LEFT_HEADING_FIELDS = [
  'Michael Romero',
  '304 W Avenue 43,',
  'Los Angeles, CA 90065',
  '(909) 201-1181',
  'mikeromero4@Yahoo.com',
  'Plaintiff in Pro Per',
];

export const DEFAULT_RIGHT_HEADING_FIELDS = [
  'Case No. CIVRS2501874',
  'Assigned Judge: Hon. Kory Mathewson',
  '8303 Haven Avenue',
  'Rancho Cucamonga, CA 91730',
  'Dept R12',
];

export const DEFAULT_PLAINTIFF_NAME = 'Michael James Romero';
export const DEFAULT_DEFENDANT_NAME = 'Megan Nicole Bentley';
export const DEFAULT_COURT_TITLE = 'SUPERIOR COURT OF THE STATE OF CALIFORNIA, COUNTY OF SAN BERNARDINO';

export const DEFAULT_WELCOME_TITLE = 'Welcome';
export const DEFAULT_WELCOME_CONTENT = '# Welcome to the legal drafting preview\n\nUse the panel on the left to add Markdown notes or attach PDFs. Drag the order using the arrows to see how the combined packet will render when printed.';

// Default PDF present in public/pdfs
export const DEFAULT_PDF_DIR = '/pdfs';
export const DEFAULT_PDF_FILE = 'ammended notice2.pdf';
export const DEFAULT_PDF_PATH = `${DEFAULT_PDF_DIR}/${encodeURIComponent(DEFAULT_PDF_FILE)}`;

// Misc settings
export const PRINT_DOCUMENT_TITLE = 'legal-drafting-preview';
export const COMPILED_PDF_DOWNLOAD_NAME = 'combined.pdf';
export const CONFIRM_DELETE_MESSAGE = 'Delete this section? This cannot be undone.';
export const UNDO_THROTTLE_MS = 800;
