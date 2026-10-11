import type { MetadataRoute } from "next";

import { PUBLIC_PAGES } from "./(public)/explore/_site/site";
import { env } from "@/lib/env";

/** The public pages, and only those. Shared decisions are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((p) => ({
    url: `${env.canonicalUrl}${p.path}`,
    changeFrequency: "weekly",
    priority: p.priority,
  }));
}
