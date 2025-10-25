import type { Metadata } from "next";
import "./globals.css";
import styles from "@/styles/Layout.module.css";

export const metadata: Metadata = {
  title: "Legal Drafting Preview",
  description: "Live print preview for legal drafting content"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={styles.body}>{children}</body>
    </html>
  );
}
