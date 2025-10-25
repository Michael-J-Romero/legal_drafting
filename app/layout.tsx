import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Document Assembly Preview',
  description:
    'Interactive playground for rendering mixed markdown and PDF fragments with print-ready pagination.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
