import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "ระบบคลังสินค้า (Inventory Management)",
  description: "Next.js + Tailwind + SCSS + Google Sheet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
