import "./globals.css";
import type { Viewport } from "next";

export const metadata = { title: "MobileGlam Dashboard" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
