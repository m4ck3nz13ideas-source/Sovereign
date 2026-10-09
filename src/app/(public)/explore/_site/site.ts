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
      { href: "/explore#try", label: "Try it" },
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
      { href: "/explore/privacy", label: "Privacy" },
      { href: "/explore/terms", label: "Terms" },
    ],
  },
];
