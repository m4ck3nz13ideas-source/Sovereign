import type { Metadata, Viewport } from "next";

import { currentTheme } from "@/lib/theme";

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
    "Decide what matters, together. Vote on ideas, not politicians.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sovereign",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * The theme is decided here, on the server, from a cookie.
 *
 * No attribute means follow the device. An explicit choice becomes
 * `data-theme`, which sets `color-scheme` and flips every token in
 * globals.css. Doing it in the markup rather than in a script is the whole
 * point: a theme applied after paint is a white flash on a black app.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = await currentTheme();

  return (
    <html lang="en" data-theme={theme === "system" ? undefined : theme}>
      <body className="min-h-dvh bg-ink text-paper antialiased">{children}</body>
    </html>
  );
}
