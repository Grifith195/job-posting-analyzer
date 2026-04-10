import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Posting Analyzer",
  description: "Analyze Canadian job postings against a resume.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
