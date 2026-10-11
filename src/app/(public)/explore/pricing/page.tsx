import Link from "next/link";

import { CtaBand, Faq, PageHero, Section, Tick } from "../_site/blocks";
import { CONTACT_EMAIL, pageMeta } from "../_site/site";

export const metadata = pageMeta("pricing");

const PLANS = [
  {
    name: "People",
    price: "Free",
    note: "For good",
    lead: "Everything. For everyone.",
    cta: { label: "Start free", href: "/login" },
    featured: true,
    points: [
      "Private space, journal and AI",
      "Know yourself and Learn",
      "Feed, likes, comments and chats",
      "Search, with every side of a question",
      "Propose, respond and act at every scale",
      "Buy from verified businesses",
      "SOV for what you finish",
    ],
  },
  {
    name: "Business listing",
    price: "Talk to us",
    note: "Verified listing",
    lead: "Sell your products and services in the Market.",
    cta: { label: "Apply to list", href: "/explore/business" },
    featured: false,
    points: [
      "Website ownership proven",
      "Companies House check for UK businesses",
      "Read against the ten laws, signed off by a person",
      "A verified business page",
      "Buyer concerns go to reviewers, never made public",
    ],
  },
  {
    name: "Advertising",
    price: "Pay per click",
    note: "Rates on request",
    lead: "Reach people whose values match yours.",
    cta: { label: "Contact sales", href: `mailto:${CONTACT_EMAIL}?subject=Advertising` },
    featured: false,
    points: [
      "Charged per click, once per person per day",
      "Never your own clicks, never past budget",
      "Best fit wins; your bid breaks ties",
      "Shown in Search and the Market",
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Free for people. Paid by aligned businesses."
        lead="No subscriptions. No premium tier. No paying for reach. Businesses pay to be seen — never to be approved."
      />
      <Section>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-sheet border p-7 ${p.featured ? "border-gold-dim bg-gold-wash" : "border-line"}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-paper">{p.name}</p>
                {p.featured ? <span className="rounded-pill bg-gold px-2.5 py-0.5 text-xs font-semibold text-ink">For you</span> : null}
              </div>
              <p className="mt-6 font-serif text-4xl text-paper">{p.price}</p>
              <p className="mt-1 text-sm text-paper-faint">{p.note}</p>
              <p className="mt-4 text-paper-dim">{p.lead}</p>
              <Link
                href={p.cta.href}
                className={`press mt-6 flex justify-center rounded-pill px-6 py-3 font-semibold ${
                  p.featured ? "bg-gold text-ink" : "border border-line text-paper hover:bg-surface"
                }`}
              >
                {p.cta.label}
              </Link>
              <ul className="mt-8 space-y-3 border-t border-line pt-6">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-3 text-[0.95rem] text-paper-dim">
                    <Tick className="mt-0.5" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-surface-soft">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
          <h2 className="font-serif text-3xl text-paper">Pricing questions</h2>
          <Faq
            items={[
              {
                q: "Will people ever have to pay?",
                a: "No. Aligned businesses pay, by advertising to people they fit.",
              },
              {
                q: "Can a business pay to get approved?",
                a: "No. Nothing that approves or ranks a business can read what it spends, and automated checks fail the build if one does. Lose approval and ads stop at once.",
              },
              {
                q: "Can a business pay for the top slot?",
                a: "No. The slot goes to the best fit for the person looking: 70% values match, 30% vetting. Bids only break ties.",
              },
              {
                q: "Do you take a cut of sales?",
                a: "Not today: buying happens on the business's site. Any future fee is published here first.",
              },
            ]}
          />
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
