import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ScopePay", description: "Review client change requests, get paid and schedule the work.", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
