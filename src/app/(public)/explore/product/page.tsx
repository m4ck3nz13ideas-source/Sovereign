import type { ReactNode } from "react";

import { Container, CtaBand, PageHero, PrimaryLink, Section, SecondaryLink, TickList } from "../_site/blocks";
import { FeedScreen, MarketScreen, PhoneFrame, ProposalScreen, SelfScreen } from "../_site/mockups";
import { PILLARS } from "./pillars";

export const metadata = { title: "Product" };

function SearchScreen() {
  return (
    <div className="space-y-3 pt-2" aria-hidden="true">
      <div className="rounded-pill border border-line px-3 py-2 text-[11px] text-paper">Should school start later?</div>
      {[
        ["The literature", "Sleep research on teenage body clocks points one way; transport studies another."],
        ["The traditions", "Rhythms of rest and work, and who the day is arranged around."],
        ["The practitioners", "Teachers, parents and bus operators on what changes in practice."],
      ].map(([lens, t]) => (
        <div key={lens} className="rounded-xl border border-line p-3">
          <p className="smallcaps text-[9px] text-gold">{lens}</p>
          <p className="mt-1 text-[11px] leading-snug text-paper-dim">{t}</p>
        </div>
      ))}
      <p className="text-[10px] text-paper-faint">Positions, side by side. No single answer, no ranking.</p>
    </div>
  );
}

const SECTIONS: { id: string; tab: number; title: string; lead: string; points: ReactNode[]; screen: ReactNode }[] = [
  {
    id: "individual",
    tab: 0,
    title: "A private space that's actually private.",
    lead: "Journal, ideas, to-dos and a vault — plus an AI that knows what you value because you told it, and nobody else can read.",
    points: [
      "Owner-only by database policy. Not a toggle.",
      "Know yourself: needs, values, beliefs and goals, at the centre of your AI.",
      "Call your AI from anywhere in your space.",
      "Your SOV balance and record, kept in the vault.",
    ],
    screen: <SelfScreen />,
  },
  {
    id: "home",
    tab: 1,
    title: "Social media that leaves you better off.",
    lead: "Posts from people you follow, in time order. Every post is read once at the door: true to its author, or useful to others.",
    points: [
      "For you, Following and Discover — at your street, region, nation or the world.",
      "Likes and comments, shown openly and never used to rank.",
      "No follower counts and no people-you-may-know.",
      "Chats with friends, without read receipts or online status.",
      "Narrow your feed or mute someone. Only you know.",
    ],
    screen: <FeedScreen />,
  },
  {
    id: "search",
    tab: 2,
    title: "Search anything. Hear every side.",
    lead: "Find what's been proposed, decided and built. Ask a contested question and get positions from different ways of knowing, side by side.",
    points: [
      "Your own notes and the shared record, searched together, listed apart.",
      "At least two perspectives on every contested question. Never one verdict.",
      "One relevant, labelled ad — chosen by fit, not by bid.",
    ],
    screen: <SearchScreen />,
  },
  {
    id: "market",
    tab: 3,
    title: "Like a high street of businesses you'd vouch for.",
    lead: "Products and services from businesses that proved they're real and passed the ten laws. For people, not profit.",
    points: [
      "Website ownership proven. UK companies checked against Companies House.",
      "Read against all ten laws by AI, then signed off by a person.",
      "Change your listing and approval lapses until it's read again.",
      "Choose buy or sell up front. Buying links to the business for now.",
    ],
    screen: <MarketScreen />,
  },
  {
    id: "collective",
    tab: 4,
    title: "Decide together, without the shouting.",
    lead: "Proposals from your street to the planet. Checked against the law first, decided on their own conditions, then turned into projects.",
    points: [
      "Respond with alignment, confidence and urgency — not yes or no.",
      "The lean stays hidden until it closes. A split is reported as a split.",
      "Concerns get written answers. Challenges never stall a decision.",
      "What passes becomes a project, and its outcome is marked against the prediction.",
    ],
    screen: <ProposalScreen />,
  },
];

export default function ProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Product"
        title="Five spaces. One set of laws."
        lead="Sovereign brings your private life, your social life, your shopping and your say into one calm app."
      >
        <PrimaryLink href="/login">Get started free</PrimaryLink>
        <SecondaryLink href="/explore#try">Try the demo</SecondaryLink>
      </PageHero>

      <nav className="sticky top-[61px] z-30 border-b border-line-soft bg-veil backdrop-blur-xl" aria-label="Sections">
        <Container className="flex gap-1 overflow-x-auto py-2">
          {PILLARS.map((p) => (
            <a key={p.id} href={`#${p.id}`} className="shrink-0 rounded-pill px-3.5 py-1.5 text-sm text-paper-dim hover:bg-surface hover:text-paper">
              {p.name}
            </a>
          ))}
        </Container>
      </nav>

      {SECTIONS.map((s, i) => {
        const pillar = PILLARS.find((p) => p.id === s.id)!;
        return (
          <Section key={s.id} id={s.id} className={i % 2 ? "bg-surface-soft" : ""}>
            <div className="grid items-center gap-14 lg:grid-cols-2">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-card bg-gold-wash text-gold">{pillar.icon}</span>
                  <p className="smallcaps text-[11px] font-semibold text-gold">{pillar.name}</p>
                </div>
                <h2 className="mt-5 font-serif text-3xl leading-tight text-paper sm:text-4xl">{s.title}</h2>
                <p className="mt-4 text-lg leading-relaxed text-paper-dim">{s.lead}</p>
                <div className="mt-8">
                  <TickList items={s.points} />
                </div>
              </div>
              <PhoneFrame active={s.tab}>{s.screen}</PhoneFrame>
            </div>
          </Section>
        );
      })}

      <Section>
        <div className="max-w-2xl">
          <p className="smallcaps text-[11px] font-semibold text-gold">Under the hood</p>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-paper sm:text-4xl">Rules in the database, not promises in a policy.</h2>
          <p className="mt-4 text-lg leading-relaxed text-paper-dim">
            Every promise on this site is a rule the database enforces, with hundreds of automated checks that fail
            the build if one is ever broken.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Row-level security", "Who can read each row is decided in Postgres, for every request."],
            ["Signed AI", "Every AI reading that decides something carries a server signature. Forged or stale ones are refused."],
            ["Written once", "Law readings, flags and debate can't be edited after the fact. Answers are signed by whoever wrote them."],
            ["Tamper-evident ledger", "Decisions are chained, so any change to the record shows."],
            ["No third parties", "No trackers, no ad networks, fonts served from Sovereign itself."],
            ["Open about money", "Nothing that approves or ranks a business can read what it spends."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-sheet border border-line p-6">
              <p className="font-semibold text-paper">{t}</p>
              <p className="mt-1.5 text-paper-dim">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
