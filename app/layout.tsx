import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Serchify - SEO Intelligence",
  description: "AI-powered SEO tools for e-commerce. Site audits, content optimization, keyword research, and schema generation.",
  icons: {
    icon: "/seargence.png",
    apple: "/seargence.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
