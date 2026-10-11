import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/**
 * Search engines may read the public site and nothing else. Everything
 * outside /explore is behind sign-in anyway; this says so up front.
 * Shared decision pages are readable but ask not to be listed (their own
 * robots meta) — a link someone sent is not a page to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/explore", "/opengraph-image"], disallow: ["/"] },
    sitemap: `${env.canonicalUrl}/sitemap.xml`,
  };
}
