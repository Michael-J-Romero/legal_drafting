// Removed react-pdf CSS imports; not using react-pdf components and it can pull pdfjs unexpectedly

import type { ReactNode } from 'react';

import '../App.css';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
