import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Jipity", description: "Private AI companion" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
