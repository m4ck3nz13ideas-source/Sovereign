import Link from "next/link";

import { CtaBand, Faq, PageHero, Section, Tick } from "../_site/blocks";
import { CONTACT_EMAIL } from "../_site/site";

export const metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "People",
    price: "Free",
    note: "Always",
    lead: "Everything in Sovereign, for everyone.",
    cta: { label: "Get started", href: "/login" },
    featured: true,
    points: [
      "Your private space, journal and AI",
      "Know yourself",
      "Home feed, likes, comments and chats",
      "Search, with every side of a question",
      "Propose, respond and join projects at every scale",
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
      "Only charged when someone clicks",
      "Once per person per day, never your own clicks",
      "Never past your budget",
      "Shown in Search and the Market",
      "Slot goes to the best fit — your bid breaks ties",
      "Clicks and spend reported to you",
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Free for people. Paid by aligned businesses."
        lead="No subscriptions, no premium tier, no paying for reach on your posts. Businesses that pass the ten laws pay to be seen — never to be approved."
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
                a: "No. Sovereign is free for people. It's paid for by aligned businesses advertising to people they fit.",
              },
              {
                q: "Can a business pay to get approved?",
                a: "No. Nothing that approves or ranks a business can read what it spends — automated checks fail the build if one ever does. If approval lapses, its ads stop at once.",
              },
              {
                q: "Can a business pay for the top slot?",
                a: "No. The sponsored slot goes to the best fit for the person looking: 70% how well the business matches the values they wrote, 30% how cleanly it passed the laws. Bids only break ties.",
              },
              {
                q: "Do you take a cut of sales?",
                a: "Not today — buying happens on the business's own site. When payments move into the app, any fee will be published here first.",
              },
            ]}
          />
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
