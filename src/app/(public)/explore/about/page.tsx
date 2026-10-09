import { UNIVERSAL_LAWS } from "@/lib/universal-law";

import { Cross, CtaBand, PageHero, Section, SectionHead } from "../_site/blocks";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Every leap in technology changed how we govern. Except this one."
        lead="Sovereign exists to bring the way we decide up to date with everything else — so freedom, truth and care for life are how a society is run, not just what it hopes for."
      />

      {/* ------------------------------------------------------- FOUNDER */}
      <Section id="founder">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="smallcaps text-[11px] font-semibold text-gold">Founder&apos;s note</p>
            <div className="mt-6 flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-wash font-serif text-2xl text-gold">M</span>
              <div>
                <p className="font-semibold text-paper">Mackenzie</p>
                <p className="text-paper-dim">Founder, Sovereign</p>
              </div>
            </div>
          </div>
          <div className="space-y-5 text-lg leading-relaxed text-paper-dim">
            <p className="font-serif text-2xl leading-snug text-paper">
              Many of us feel it. The way we run things isn&apos;t working, and the people in charge can&apos;t fix it
              from the top.
            </p>
            <p>
              For most of history, power has flowed downward — kings, empires, states, corporations. Every time
              technology leapt forward, the way we governed ourselves changed with it. Writing, printing, the factory.
              But the internet and AI haven&apos;t touched how we decide. We still vote for people every few years and
              hope.
            </p>
            <p>
              Too many faceless, nameless people have lived and died dreaming of heaven on earth. They didn&apos;t do it
              for nothing. They moved the needle closer to this moment — when the tools finally exist for people to
              govern themselves, at every scale, without anyone on top.
            </p>
            <p>
              I&apos;m building Sovereign so that each person can govern themselves fully, and still choose to
              contribute to something bigger. Not individualism, which isolates. Not collectivism, which coerces.
              Both, held together by ten laws that apply to everyone — people, businesses, governments and code alike.
            </p>
            <p>
              It starts small: fifty people using it for real. If you&apos;re reading this, I&apos;d like you to be one of
              them.
            </p>
            <p className="font-serif text-xl text-paper">— Mackenzie</p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------- PHILOSOPHY */}
      <Section className="bg-surface-soft">
        <SectionHead
          eyebrow="The idea"
          title="Individual Collectivism."
          lead="Freedom without care breeds chaos. Unity without freedom breeds tyranny. Sovereign is built on the balance between them."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["Power flows outward", "From the individual to the collective, never top-down. Decisions are made at the smallest scale that can make them."],
            ["Alignment, not majority", "People say how aligned they are, not just yes or no. A proposal passes on alignment, and a split is never called a consensus."],
            ["Evolution by design", "Every decision is measured afterwards. No law is final, and changing one needs every single voice."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-sheet border border-line bg-ink p-6">
              <p className="font-serif text-xl text-paper">{t}</p>
              <p className="mt-2 text-paper-dim">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------- REFUSALS */}
      <Section>
        <SectionHead
          eyebrow="What we won't build"
          title="Some features are missing on purpose."
          lead="Each of these is ruled out in the database, with a check that fails if anyone adds it back."
        />
        <ul className="mt-12 grid gap-x-10 gap-y-1 sm:grid-cols-2">
          {[
            "A feed ranked by engagement",
            "Follower counts or people-you-may-know",
            "Live tallies before a decision closes",
            "Read receipts, typing dots or online status",
            "A score on any person",
            "Approval you can buy",
            "One AI answer to a contested question",
            "A way to edit the record after the fact",
          ].map((t) => (
            <li key={t} className="flex items-center gap-3 border-b border-line py-4 text-lg text-paper">
              <Cross />
              {t}
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ LAWS */}
      <Section id="laws" className="bg-surface-soft">
        <SectionHead
          eyebrow="The constitution"
          title="The ten Universal Laws."
          lead="Everyone agrees to these on joining. They sit above every proposal, business and line of code. The wording can be amended — only if every voice agrees."
        />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2">
          {UNIVERSAL_LAWS.map((l) => (
            <li key={l.id} className="rounded-sheet border border-line bg-ink p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-2xl tabular-nums text-gold">{l.ordinal}</span>
                <p className="text-lg font-semibold text-paper">{l.name}</p>
              </div>
              <p className="mt-2 leading-relaxed text-paper-dim">{l.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <CtaBand />
    </>
  );
}
