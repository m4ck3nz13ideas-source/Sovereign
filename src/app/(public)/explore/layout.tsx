import type { Metadata } from "next";

import { SiteFooter } from "./_site/SiteFooter";
import { SiteHeader } from "./_site/SiteHeader";

export const metadata: Metadata = {
  title: { default: "Sovereign — Better decisions. Together.", template: "%s · Sovereign" },
  description: "Vote on ideas, not politicians. A private space, an honest feed, a market for aligned businesses and a fairer way to decide — together.",
  openGraph: {
    title: "Sovereign — Better decisions. Together.",
    description: "Vote on ideas, not politicians. Try it before you join.",
    type: "website",
    siteName: "Sovereign",
  },
};

/**
 * The public site, for people who have not joined. One header, one footer,
 * every page under /explore (the prefix the proxy lets through).
 *
 * The body is select-none for the app's sake; a website is read and quoted,
 * so text is selectable here.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-selectable className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
