/**
 * The public site's map, written once so the header, the footer and the pages
 * cannot disagree about where anything lives.
 *
 * Everything sits under /explore because that is the one public prefix the
 * proxy already lets through (src/proxy.ts). A new public page goes here and
 * nowhere else.
 */

/** Where every "contact us" goes. Change it here once the inbox exists. */
export const CONTACT_EMAIL = "connect@mackiavelli.co.uk";

/**
 * Who the data controller is, for the privacy notice. Fill in the legal name
 * (yours as a sole trader, or the company's) before launch.
 */
export const CONTROLLER = {
  name: "Sovereign, run by Mackenzie",
  /** ICO data protection fee registration number. Shown only once it exists. */
  icoRegistration: null as string | null,
};

/** The founding cohort: the people Sovereign is being made ready for. */
export const FOUNDING_PLACES = 50;

export const NAV: { href: string; label: string }[] = [
  { href: "/explore/product", label: "Product" },
  { href: "/explore/trust", label: "Trust" },
  { href: "/explore/business", label: "For business" },
  { href: "/explore/pricing", label: "Pricing" },
  { href: "/explore/roadmap", label: "Roadmap" },
  { href: "/explore/about", label: "About" },
  { href: "/explore/faq", label: "FAQ" },
];

export const FOOTER: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/explore/product", label: "Overview" },
      { href: "/explore/sample-decision", label: "Sample decision" },
      { href: "/explore#try", label: "Try it" },
      { href: "/explore#today", label: "What works today" },
      { href: "/explore/pricing", label: "Pricing" },
      { href: "/explore/roadmap", label: "Roadmap" },
    ],
  },
  {
    title: "Business",
    links: [
      { href: "/explore/business", label: "Sell on Sovereign" },
      { href: "/explore/business#verified", label: "Get verified" },
      { href: "/explore/business#advertise", label: "Advertise" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/explore/about", label: "About" },
      { href: "/explore/about#founder", label: "Founder's note" },
      { href: "/explore/about#laws", label: "Universal Laws" },
      { href: "/explore/contact", label: "Contact" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/explore/faq", label: "FAQ" },
      { href: "/explore/trust", label: "Trust and privacy" },
      { href: "/explore/privacy", label: "Privacy notice" },
      { href: "/explore/terms", label: "Terms" },
    ],
  },
];

/**
 * Every public page's search and preview copy, written once: the title, one
 * precise sentence for search results, and the headline on its link-preview
 * card (drawn by explore/og/[page]). The sitemap reads this list too.
 */
export const PAGES = {
  product: {
    title: "Product",
    description: "Think in private. Post honestly. Decide together. Plus a market of vetted businesses, in one calm app.",
    card: "Five spaces. One set of laws.",
    priority: 0.9,
  },
  business: {
    title: "For business",
    description: "Prove you are real, pass ten laws, reach people who share your values. Pay per click, never for approval.",
    card: "Sell to people who care how you do business.",
    priority: 0.8,
  },
  pricing: {
    title: "Pricing",
    description: "Free for people, for good. Aligned businesses pay per click. Money never buys approval or rank.",
    card: "Free for people. Paid by aligned businesses.",
    priority: 0.8,
  },
  "sample-decision": {
    title: "Sample decision",
    description: "Walk through one illustrative decision, from the problem to the review. Example data, no account needed.",
    card: "One decision, start to finish.",
    priority: 0.8,
  },
  trust: {
    title: "Trust",
    description: "What is private, what is shared, how AI is used, and which safeguards are working today. Checked against the running system.",
    card: "Trust should be inspectable.",
    priority: 0.8,
  },
  roadmap: {
    title: "Roadmap",
    description: "What is current, what is in testing, what is planned. Nothing is marked current until it works in production.",
    card: "Current. In testing. Planned.",
    priority: 0.7,
  },
  about: {
    title: "About",
    description: "Every leap in technology changed how we govern, except this one. Why Sovereign exists.",
    card: "Every leap in technology changed how we govern. Except this one.",
    priority: 0.7,
  },
  faq: {
    title: "FAQ",
    description: "Cost, privacy, age, decisions and businesses: straight answers about Sovereign.",
    card: "Straight answers.",
    priority: 0.7,
  },
  contact: {
    title: "Contact",
    description: "Write to the founder. A person reads every message.",
    card: "Talk to a person.",
    priority: 0.5,
  },
  privacy: {
    title: "Privacy notice",
    description: "What Sovereign collects, why, who can read it, and how to take or delete it. UK GDPR.",
    card: "Your data is yours. Here is the proof.",
    priority: 0.4,
  },
  terms: {
    title: "Terms",
    description: "The terms for using Sovereign.",
    card: "Terms of use.",
    priority: 0.3,
  },
} as const;

export type PageSlug = keyof typeof PAGES;

/** One page's metadata: title, description, canonical address, preview card. */
export function pageMeta(slug: PageSlug) {
  const p = PAGES[slug];
  const path = `/explore/${slug}`;
  const title = `${p.title} · Sovereign`;
  const image = { url: `/explore/og/${slug}`, width: 1200, height: 630, alt: p.card };
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: path },
    openGraph: { title, description: p.description, url: path, siteName: "Sovereign", type: "website" as const, images: [image] },
    twitter: { card: "summary_large_image" as const, title, description: p.description, images: [image.url] },
  };
}

/** Every public page, for the sitemap. */
export const PUBLIC_PAGES: { path: string; priority: number }[] = [
  { path: "/explore", priority: 1 },
  ...(Object.keys(PAGES) as PageSlug[]).map((slug) => ({ path: `/explore/${slug}`, priority: PAGES[slug].priority })),
];
