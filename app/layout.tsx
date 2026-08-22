import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jipity | Truth, Wisdom, Freedom",
  description: "Your private AI companion for truth, wisdom, and freedom.",
  robots: {
    index: false,
    follow: false,
  },
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
