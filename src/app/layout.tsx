import type { Metadata, Viewport } from "next";

/**
 * Fonts are self-hosted rather than loaded from Google.
 *
 * Partly because it is faster and removes a build-time network dependency, and
 * partly because a product whose first claim is that your data is yours should
 * not make every reader's browser announce itself to a third party to render a
 * heading.
 *
 * Variable weights, so one file per family covers the whole range.
 */
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/inter";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sovereign",
  description:
    "A quiet place to think, and a way for a group to decide together. Individual space, collective space, and the record of what happened.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sovereign",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink text-paper antialiased">{children}</body>
    </html>
  );
}
