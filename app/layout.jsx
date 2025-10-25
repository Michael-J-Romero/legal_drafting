import './globals.css';

export const metadata = {
  title: 'Legal Drafting Workspace',
  description: 'Compose legal packets with Markdown and PDF fragments.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
