import { pageCard } from "@/lib/og";

import { PAGES, type PageSlug } from "../../_site/site";

/** A public page's link-preview card, from its line in PAGES. */
export async function GET(_req: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!(page in PAGES)) return new Response("Not found", { status: 404 });
  const p = PAGES[page as PageSlug];
  return pageCard({ eyebrow: p.title, title: p.card, line: p.description });
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((page) => ({ page }));
}
