import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import './globals.css';

export const metadata = {
  title: 'Legal Drafting Document Builder',
  description:
    'Assemble legal pleading packets by combining Markdown notes and uploaded PDFs in the browser.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
