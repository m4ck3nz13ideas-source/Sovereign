import Link from "next/link";

import { UNIVERSAL_LAWS } from "@/lib/universal-law";

import { Demos } from "./Demos";
import {
  ArrowLink,
  Container,
  CtaBand,
  Cross,
  Eyebrow,
  Faq,
  FoundingFifty,
  PrimaryLink,
  PulseStrip,
  Section,
  SectionHead,
  SecondaryLink,
  Tick,
} from "./_site/blocks";
import { PhoneFrame, ProposalScreen } from "./_site/mockups";
import { getPulse } from "./_site/pulse";
import { FAQ_HOME } from "./faq/questions";
import { PILLARS } from "./product/pillars";
import { ROADMAP } from "./roadmap/items";

export const metadata = {
  title: { absolute: "Sovereign — Better decisions. Together." },
  alternates: { canonical: "/explore" },
};

export const dynamic = "force-dynamic";

/**
 * The public front of Sovereign.
 *
 * The app itself does not explain anything; this site does, by showing. Every
 * number on it is a total from public_pulse() (0037) or a demo running in the
 * visitor's browser, and every claim is one a rule in CLAUDE.md keeps.
 */
export default async function ExplorePage() {
  const pulse = await getPulse();

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] opacity-70"
          style={{ background: "radial-gradient(60% 60% at 70% 30%, var(--color-gold-wash), transparent 70%)" }}
          aria-hidden="true"
        />
        <Container className="relative grid items-center gap-14 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:pb-24">
          <div>
            <Link
              href="#founding"
              className="inline-flex items-center gap-2 rounded-pill border border-line bg-ink py-1 pr-3 pl-1 text-sm text-paper-dim hover:text-paper"
            >
              <span className="rounded-pill bg-gold px-2 py-0.5 text-xs font-semibold text-ink">Open</span>
              Founding 50 places <span aria-hidden="true">→</span>
            </Link>
            <h1 className="mt-6 font-serif text-5xl leading-[1.02] tracking-tight text-paper sm:text-7xl">
              Better decisions.
              <br />
              Together.
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-snug text-paper-dim">
              Vote on ideas, not politicians. <span className="text-paper">Think in private. Post honestly. Decide
              together</span> — from your street to the planet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href="/login">Start free</PrimaryLink>
              <SecondaryLink href="#try">Try it first</SecondaryLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper-dim">
              {["Free for people", "Private by rule", "No follower counts"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Tick className="h-4 w-4" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <PhoneFrame>
              <ProposalScreen />
            </PhoneFrame>
          </div>
        </Container>
      </section>

      {/* --------------------------------------------------------------- PULSE */}
      {pulse ? (
        <Container>
          <PulseStrip pulse={pulse} />
        </Container>
      ) : null}

      {/* ------------------------------------------------------------ PROBLEM */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <SectionHead
            eyebrow="The problem"
            title="We reached the moon. We still can't decide together."
            lead="Writing built kingdoms. Print built nations. The internet changed everything — except how we decide."
          />
          <div className="grid gap-4">
            {[
              ["Top-down", "We vote for people every few years, then hope."],
              ["Ranked", "Feeds sort by outrage and by whoever pays for reach."],
              ["Forgotten", "Nobody checks whether the last decision worked."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-card border border-line p-5">
                <p className="font-semibold text-paper">{t}</p>
                <p className="mt-1.5 text-paper-dim">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ PILLARS */}
      <Section className="bg-surface-soft">
        <SectionHead
          center
          eyebrow="One app, five spaces"
          title="Everything a person and a people need."
          lead="Private where it should be. Public where it must be. One set of laws."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <Link
              key={p.id}
              href={`/explore/product#${p.id}`}
              className="press group rounded-sheet border border-line bg-ink p-6 hover:border-gold-dim"
            >
              <span className="grid h-11 w-11 place-items-center rounded-card bg-gold-wash text-gold">{p.icon}</span>
              <p className="mt-5 font-serif text-2xl text-paper">{p.name}</p>
              <p className="mt-2 text-paper-dim">{p.short}</p>
              <p className="mt-4 text-sm font-semibold text-gold opacity-0 transition-opacity group-hover:opacity-100">
                See how →
              </p>
            </Link>
          ))}
          <div className="flex flex-col justify-between rounded-sheet border border-dashed border-line p-6">
            <p className="font-serif text-2xl text-paper">See it all working.</p>
            <div className="mt-6">
              <ArrowLink href="/explore/product">Product tour</ArrowLink>
            </div>
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------------------- DEMOS */}
      <Section id="try">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <SectionHead
              eyebrow="Try it"
              title="Use it before you join."
              lead="Runs in your browser. No account, nothing sent, nothing saved."
            />
            <ul className="mt-8 space-y-3 text-paper-dim">
              {[
                ["Individual", "a private AI that knows your values"],
                ["Home", "the check every post passes"],
                ["Search", "one ad, chosen by fit, not by bid"],
                ["Market", "how a business proves it's real"],
                ["Collective", "a proposal decided on its own conditions"],
              ].map(([t, d]) => (
                <li key={t}>
                  <span className="font-semibold text-paper">{t}</span> — {d}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <Demos />
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------------- HOW */}
      <Section className="bg-surface-soft">
        <SectionHead center eyebrow="How it works" title="Idea to outcome, in five steps." />
        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Propose", "Anyone, at any scale, street to planet."],
            ["Check", "AI reads it against ten laws and sets fair conditions."],
            ["Decide", "Alignment, confidence, urgency. The lean stays hidden until close."],
            ["Act", "What passes becomes a project, staffed by who offered."],
            ["Learn", "Outcomes marked against predictions. The next decision improves."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-sheet border border-line bg-ink p-6">
              <span className="font-serif text-3xl tabular-nums text-gold">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-4 text-lg font-semibold text-paper">{t}</p>
              <p className="mt-1.5 text-paper-dim">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------- COMPARISON */}
      <Section>
        <SectionHead
          eyebrow="Why it's different"
          title="Built to make you think, not scroll."
          lead="Enforced by the database. Not promised in a policy."
        />
        <div className="mt-12 overflow-hidden rounded-sheet border border-line">
          <div className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-line bg-surface-soft text-sm font-semibold">
            <p className="p-4 text-paper-faint sm:px-6"> </p>
            <p className="p-4 text-paper-dim sm:px-6">The usual</p>
            <p className="p-4 text-gold sm:px-6">Sovereign</p>
          </div>
          {[
            ["You vote for", "People, every few years", "Ideas, whenever they come up"],
            ["The running result", "Shown, so people pile on", "Hidden until it closes"],
            ["Who voted how", "Visible to the group", "Secret. Only the tally is shown"],
            ["Your feed", "Ranked by engagement", "Time order. Likes never rank it"],
            ["Follower counts", "Front and centre", "None, anywhere"],
            ["Your private notes", "Mined for targeting", "Owner-only. Advertisers never see them"],
            ["Top ad", "Highest bidder", "Best fit for you; bids only break ties"],
            ["A split vote", "Reported as a win", "Reported as a split"],
          ].map(([k, a, b]) => (
            <div key={k} className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-line-soft text-[0.95rem] last:border-0">
              <p className="p-4 font-semibold text-paper sm:px-6">{k}</p>
              <p className="flex gap-2 p-4 text-paper-faint sm:px-6">
                <Cross className="mt-0.5 hidden sm:block" />
                {a}
              </p>
              <p className="flex gap-2 p-4 text-paper sm:px-6">
                <Tick className="mt-0.5 hidden sm:block" />
                {b}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------------- LAWS */}
      <Section className="bg-surface-soft">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionHead
              eyebrow="The constitution"
              title="Ten Universal Laws."
              lead="Above every decision, every business, every line of code. Break one and a proposal fails, whatever the vote."
            />
            <div className="mt-6">
              <ArrowLink href="/explore/about#laws">Read them in full</ArrowLink>
            </div>
          </div>
          <ol className="grid gap-x-8 sm:grid-cols-2">
            {UNIVERSAL_LAWS.map((l) => (
              <li key={l.id} className="flex items-baseline gap-4 border-b border-line py-4">
                <span className="w-6 font-serif tabular-nums text-gold">{l.ordinal}</span>
                <span className="text-lg text-paper">{l.name}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ---------------------------------------------------------- FOUNDER */}
      <Section>
        <figure className="mx-auto max-w-3xl text-center">
          <Eyebrow>Why I&apos;m building this</Eyebrow>
          <blockquote className="mt-6 font-serif text-2xl leading-snug text-paper sm:text-3xl">
            “Too many faceless, nameless humans of history have lived and died, fought and cried, dreaming of
            heaven on earth. They did not fight and die for nothing. They moved the needle closer to this moment.”
          </blockquote>
          <figcaption className="mt-6 text-paper-dim">
            Mackenzie, founder ·{" "}
            <Link href="/explore/about#founder" className="text-gold hover:underline">
              read the note
            </Link>
          </figcaption>
        </figure>
      </Section>

      {/* ---------------------------------------------------------- FOUNDING */}
      <Section id="founding" className="pt-0 sm:pt-0">
        <FoundingFifty pulse={pulse} />
      </Section>

      {/* ----------------------------------------------------------- ROADMAP */}
      <Section className="bg-surface-soft">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead eyebrow="Roadmap" title="Built in the open." />
          <ArrowLink href="/explore/roadmap">Full roadmap</ArrowLink>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {ROADMAP.map((col) => (
            <div key={col.stage} className="rounded-sheet border border-line bg-ink p-6">
              <p className={`smallcaps text-[11px] font-semibold ${col.live ? "text-calm" : "text-paper-faint"}`}>{col.stage}</p>
              <ul className="mt-4 space-y-2.5">
                {col.items.slice(0, 4).map((it) => (
                  <li key={it.title} className="flex gap-2.5 text-paper">
                    <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${col.live ? "bg-calm" : "bg-paper-faint"}`} />
                    {it.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------------------- FAQ */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <SectionHead eyebrow="FAQ" title="Questions, answered." />
            <div className="mt-6">
              <ArrowLink href="/explore/faq">All questions</ArrowLink>
            </div>
          </div>
          <Faq items={FAQ_HOME} />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
