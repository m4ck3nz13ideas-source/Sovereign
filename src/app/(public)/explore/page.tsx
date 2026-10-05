import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";

import { Demos } from "./Demos";

export const metadata = {
  title: "Sovereign — Better decisions. Together.",
  description: "Vote on policies, not politicians. Try it before you join.",
};

export const dynamic = "force-dynamic";

/**
 * The public front of Sovereign, for people who have not joined.
 *
 * The app itself no longer explains anything; this page does it once, by
 * showing. Everything on it is either a total (0037, no names, nothing per
 * person) or a demo that runs in the visitor's browser.
 */
export default async function ExplorePage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_pulse");
  const pulse = ((data ?? []) as { people: number; decisions: number; projects_done: number; businesses: number }[])[0];

  return (
    <main className="mx-auto max-w-2xl px-5 pb-24" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <nav className="flex items-center justify-between py-5">
        <span className="font-serif text-xl text-paper">Sovereign</span>
        <Link href="/login" className="press rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-ink">
          Get in
        </Link>
      </nav>

      {/* ---------------------------------------------------------------- HERO */}
      <section className="pt-10 pb-14">
        <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-paper sm:text-6xl">
          Better decisions.
          <br />
          Together.
        </h1>
        <p className="mt-6 text-xl leading-snug text-paper-dim">
          We&apos;ve been to the moon, built the internet and taught machines to talk. We still
          can&apos;t organise ourselves to end homelessness. The problem isn&apos;t the solutions.
          It&apos;s how we decide.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="press rounded-pill bg-gold px-6 py-3 font-semibold text-ink">
            Get in
          </Link>
          <a href="#try" className="press rounded-pill border border-line px-6 py-3 font-semibold text-paper">
            Try it first
          </a>
        </div>
      </section>

      {/* --------------------------------------------------------------- PULSE */}
      {pulse ? (
        <section className="grid grid-cols-2 gap-3 border-y border-line py-6 sm:grid-cols-4">
          {[
            [pulse.people, "people"],
            [pulse.decisions, "decisions made"],
            [pulse.projects_done, "projects finished"],
            [pulse.businesses, "aligned businesses"],
          ].map(([n, label]) => (
            <div key={label as string}>
              <p className="font-serif text-3xl tabular-nums text-paper">{n as number}</p>
              <p className="mt-0.5 text-sm text-paper-faint">{label as string}</p>
            </div>
          ))}
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- WHY */}
      <section className="py-14">
        <h2 className="font-serif text-3xl text-paper">Why Sovereign</h2>
        <div className="mt-6 space-y-5 text-lg leading-relaxed text-paper-dim">
          <p>
            Every leap in technology has changed how people govern themselves. Writing gave us
            kingdoms. The printing press gave us nations. The factory gave us mass politics. The
            internet and AI have changed everything — except how we decide.
          </p>
          <p>
            So power still flows top-down. We vote for people every few years and hope. Information
            is filtered, money buys influence, and the tools that could connect us are used to
            divide us.
          </p>
          <p className="text-paper">
            Sovereign flips it. You vote on ideas, not personalities. AI checks every proposal
            against ten shared laws before anyone votes. Decisions happen at the smallest scale
            that can make them — your street before your city, your city before the world. And
            every decision is measured afterwards, so the next one is better.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------- DEMOS */}
      <section id="try" className="scroll-mt-6 py-6">
        <h2 className="font-serif text-3xl text-paper">Try it</h2>
        <p className="mt-2 text-paper-dim">No account. Nothing is saved.</p>
        <div className="mt-6">
          <Demos />
        </div>
      </section>

      {/* --------------------------------------------------------------- HOW */}
      <section className="py-14">
        <h2 className="font-serif text-3xl text-paper">How it works</h2>
        <ol className="mt-6 space-y-5">
          {[
            ["Propose", "Anyone can put an idea forward, at any scale from their street to the planet."],
            ["Check", "AI reads it against the ten Universal Laws and flags what could go wrong."],
            ["Decide", "People say how aligned, confident and willing they are. No yes/no tribes."],
            ["Act", "What passes becomes a project, with the people who said they'd help."],
            ["Learn", "Every outcome is recorded against what was predicted. The system gets wiser."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="font-serif text-2xl tabular-nums text-gold">{i + 1}</span>
              <div>
                <p className="font-semibold text-paper">{t}</p>
                <p className="mt-0.5 text-paper-dim">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------------------- LAWS */}
      <section className="py-6">
        <h2 className="font-serif text-3xl text-paper">Ten Universal Laws</h2>
        <p className="mt-2 text-paper-dim">Above every decision, every business and every line of code.</p>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {UNIVERSAL_LAWS.map((l) => (
            <li key={l.id} className="py-4">
              <details>
                <summary className="flex cursor-pointer list-none items-baseline gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="w-6 tabular-nums text-paper-faint">{l.ordinal}</span>
                  <span className="text-lg text-paper">{l.name}</span>
                </summary>
                <p className="mt-2 pl-9 leading-relaxed text-paper-dim">{l.text}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* ----------------------------------------------------------- FEATURES */}
      <section className="grid gap-3 py-14 sm:grid-cols-2">
        {[
          ["Your space", "Journal, ideas, to-dos and a private AI. Only you can read it."],
          ["Home", "Posts that are true or useful. Likes, comments, chats. Ordered by time, not by outrage."],
          ["Market", "Only businesses that pass the ten laws. For people, not profit."],
          ["Collective", "Proposals, debates, projects and their results, from local to global."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-3xl border border-line p-5">
            <p className="font-serif text-xl text-paper">{t}</p>
            <p className="mt-1.5 text-paper-dim">{d}</p>
          </div>
        ))}
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      <section className="rounded-3xl bg-gold px-6 py-10 text-center text-ink">
        <p className="font-serif text-3xl">Heaven on Earth is a decision.</p>
        <p className="mt-2 text-lg">Make it with us.</p>
        <Link href="/login" className="press mt-6 inline-block rounded-pill bg-ink px-6 py-3 font-semibold text-paper">
          Get in
        </Link>
      </section>
    </main>
  );
}
