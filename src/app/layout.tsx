import type { Metadata, Viewport } from "next";
import { THEME_COLOR } from "@/styles/tokens";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pouch Club",
  description: "Pouch Clubs portal för butikerna: beställning, guide, schema och rutiner.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale was 1, which stops a person pinching to read a small label.
  // Letting the page zoom costs nothing and is a WCAG 1.4.4 failure otherwise.
  viewportFit: "cover",
  // The brand navy. Colours the browser chrome on Android and the status bar
  // area on iOS, so the app does not sit in a white frame.
  themeColor: THEME_COLOR,
};

/**
 * The document, and nothing else.
 *
 * There are two apps in here now and they must not share a shell: the staff
 * portal has a header, a sidebar and a bottom bar full of links, and a
 * supplier is an external person who may see none of them. So the chrome
 * moved down into `(staff)/layout.tsx` and `supplier/layout.tsx`, and this
 * file keeps only what a document needs.
 *
 * The entry page at `/` sits here with no shell at all — it is a front door
 * with two choices on it, and a link into the system would be one too many.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
