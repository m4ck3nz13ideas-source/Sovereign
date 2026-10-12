import type { ReactNode } from "react";

import { Container, CtaBand, PageHero, PrimaryLink, Section, SecondaryLink, TickList } from "../_site/blocks";
import { ConnectionScreen, FeedScreen, MarketScreen, PhoneFrame, ProposalScreen, SelfScreen } from "../_site/mockups";
import { PILLARS } from "./pillars";
import { pageMeta } from "../_site/site";

export const metadata = pageMeta("product");

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
      <p className="text-[10px] text-paper-faint">Every side. No verdict. No ranking.</p>
    </div>
  );
}

const SECTIONS: { id: string; tab: number; title: string; lead: string; points: ReactNode[]; screen: ReactNode }[] = [
  {
    id: "individual",
    tab: 0,
    title: "Private. By rule, not by setting.",
    lead: "Journal, ideas, to-dos and a vault. An AI that knows your values because you told it. Nobody else can read any of it.",
    points: [
      "Owner-only in the database. Not a toggle.",
      "Know yourself: needs, values, beliefs and goals, at the centre of your AI.",
      "Your SOV record, kept in the vault.",
    ],
    screen: <SelfScreen />,
  },
  {
    id: "connection",
    tab: 1,
    title: "Everyone you're with, in one place.",
    lead: "Friends, group chats, the groups you belong to, the proposals you back and the businesses you run.",
    points: [
      "Chat one to one, or with a circle of friends.",
      "Every group and every proposal you back gets its own chat.",
      "No read receipts, no typing dots, no online status.",
      "No follower counts. Nothing ranks people.",
    ],
    screen: <ConnectionScreen />,
  },
  {
    id: "feed",
    tab: 2,
    title: "Social media that leaves you better off.",
    lead: "Under the search field: post a note or media, then the feed. Time order, not engagement. Every post read once at the door.",
    points: [
      "For you, Following, Discover — at every scale.",
      "You choose who each post is for.",
      "Likes shown, never ranked by.",
    ],
    screen: <FeedScreen />,
  },
  {
    id: "search",
    tab: 2,
    title: "Search anything. Hear every side.",
    lead: "Find what was proposed, decided and built. Ask a contested question and get every side, from science, tradition and practice.",
    points: [
      "Your notes and the shared record, searched together, listed apart.",
      "Two perspectives minimum. Never one verdict.",
      "One labelled ad, chosen by fit, not by bid.",
    ],
    screen: <SearchScreen />,
  },
  {
    id: "market",
    tab: 3,
    title: "A high street you could vouch for.",
    lead: "Businesses that proved they are real and passed ten laws. Nothing else gets in.",
    points: [
      "Website proven. UK companies checked at Companies House.",
      "Read against ten laws by AI. Signed off by a person.",
      "Edit a listing and approval lapses until it is read again.",
    ],
    screen: <MarketScreen />,
  },
  {
    id: "collective",
    tab: 4,
    title: "Decide together. Without the shouting.",
    lead: "Checked against the laws. Decided on its own conditions. Turned into a project.",
    points: [
      "Respond with alignment, confidence and urgency — not yes or no.",
      "The lean stays hidden until close. A split is reported as a split.",
      "Share the decision with one link. Names never leave.",
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
        lead="Your thinking, your feed, your shopping, your say. One calm app."
      >
        <PrimaryLink href="/login">Start free</PrimaryLink>
        <SecondaryLink href="/explore#try">Try it first</SecondaryLink>
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
        const pillar = PILLARS.find((p) => p.id === (s.id === "feed" ? "search" : s.id))!;
        return (
          <Section key={s.id} id={s.id} className={i % 2 ? "bg-surface-soft" : ""}>
            <div className="grid items-center gap-14 lg:grid-cols-2">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <div className="flex items-center justify-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-card bg-gold-wash text-gold">{pillar.icon}</span>
                  <p className="smallcaps text-[11px] font-semibold text-gold">{pillar.name}</p>
                </div>
                <h2 className="mt-5 text-center font-serif text-3xl leading-tight text-paper sm:text-4xl">{s.title}</h2>
                <p className="mt-4 text-center text-lg leading-relaxed text-paper-dim">{s.lead}</p>
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
        <div className="mx-auto max-w-2xl text-center">
          <p className="smallcaps text-[11px] font-semibold text-gold">Under the hood</p>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-paper sm:text-4xl">Rules in the database, not promises in a policy.</h2>
          <p className="mt-4 text-lg leading-relaxed text-paper-dim">
            Every promise here is a database rule. Hundreds of automated checks fail the build if one breaks.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Row-level security", "Postgres decides who reads each row, on every request."],
            ["Signed AI", "Every AI reading that decides anything is signed. Forged or stale ones are refused."],
            ["Written once", "Law readings, flags and debate cannot be edited. Answers carry their author."],
            ["Tamper-evident ledger", "Decisions are chained. Any change shows."],
            ["No third parties", "No trackers. No ad networks. Fonts served from here."],
            ["Blind to money", "Nothing that approves or ranks a business can see what it spends."],
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
