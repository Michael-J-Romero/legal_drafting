import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legal Drafting Preview",
  description: "Preview markdown and PDFs in a print-friendly layout.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
