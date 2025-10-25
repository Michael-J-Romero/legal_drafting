import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Legal Drafting Preview',
  description: 'Live print preview for legal drafting markdown and PDF fragments.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
