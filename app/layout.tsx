import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ScopePay — A little clarity. A lot less scope creep.", description: "A friendly workspace for agreeing, getting paid, and scheduling client changes.", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
