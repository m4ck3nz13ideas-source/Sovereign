import Link from "next/link";
import type { ReactNode } from "react";

import { SAFEGUARDS } from "@/lib/capabilities";

import { CapabilityRow, CtaBand, PageHero, Section, StatusLegend } from "../_site/blocks";
import { CONTACT_EMAIL, pageMeta } from "../_site/site";

export const metadata = pageMeta("trust");

/**
 * The plain-English privacy and trust centre (brief of 13 October 2026, §5).
 *
 * Summary first, the legal notice on demand. Every line was checked against
 * the live database on 13 October 2026: the row-level security policies, the
 * grants, and whether an AI model is connected. The states come from
 * lib/capabilities so this page, the home page and the roadmap agree. If a
 * policy changes, this page changes in the same commit — and so does
 * /explore/privacy.
 */

function Block({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-sheet border border-line p-6 sm:p-8">
      <h2 id={`${id}-h`} className="text-center font-serif text-2xl text-paper sm:text-3xl">
        {title}
      </h2>
      {lead ? <p className="mx-auto mt-2 max-w-2xl text-center text-paper-dim">{lead}</p> : null}
      <div className="mt-6 space-y-3 leading-relaxed text-paper-dim [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-paper [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}

function Who({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-[0.95rem]">
        <caption className="sr-only">Who can see what</caption>
        <thead>
          <tr className="border-b border-line text-paper">
            <th scope="col" className="py-2 pr-4 font-semibold">Who</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Can see</th>
            <th scope="col" className="py-2 font-semibold">Cannot see</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b, c]) => (
            <tr key={a} className="border-b border-line-soft align-top">
              <th scope="row" className="py-3 pr-4 font-semibold text-paper">{a}</th>
              <td className="py-3 pr-4">{b}</td>
              <td className="py-3">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CONTENTS: [string, string][] = [
  ["private", "Private by default"],
  ["public", "What others see when you take part"],
  ["who", "Who can see what"],
  ["ai", "How AI is used"],
  ["control", "Review, export, delete"],
  ["keep", "How long we keep it"],
  ["safeguards", "Safeguards, and their state"],
  ["gaps", "What we can't promise yet"],
];

export default function TrustPage() {
  return (
    <>
      <PageHero
        eyebrow="Trust"
        title="What is private, what is shared, and what is live."
        lead="The short version of how Sovereign handles your data and your decisions, checked against the running system. The full legal notice is on the privacy page."
      >
        <ul className="grid w-full max-w-3xl gap-3 text-left sm:grid-cols-2">
          {[
            "What you write for yourself is readable by you alone — a database rule, not a setting.",
            "How you responded to a proposal is secret. The group sees the tally without names.",
            "No AI company receives anything today: no AI model is connected yet.",
            "You can download everything, or delete your account, at any time.",
          ].map((t) => (
            <li key={t} className="rounded-card border border-line-soft p-4 text-paper-dim">
              {t}
            </li>
          ))}
        </ul>
      </PageHero>

      <Section>
        <nav aria-label="On this page" className="mx-auto max-w-3xl">
          <ul className="flex flex-wrap justify-center gap-2">
            {CONTENTS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="press inline-block rounded-pill border border-line px-3 py-1.5 text-sm text-paper-dim hover:text-paper">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mx-auto mt-12 max-w-3xl space-y-8">
          <Block id="private" title="Private by default" lead="Readable by you alone. Other members cannot read these, whatever any screen does.">
            <ul>
              <li>Your journal, ideas, to-dos, Know yourself answers and learning.</li>
              <li>Your values and beliefs — unless you turn sharing on for them yourself.</li>
              <li>Proposal drafts. They stay on your device until you submit.</li>
              <li>Your searches, unless you ask a question on a proposal.</li>
              <li>How you responded to any proposal, before and after it closes.</li>
              <li>How you rated each Sphere. A group or place sees only the average, once five people have rated.</li>
              <li>Who you follow, who follows you, who you muted, whether you read a message, and your SOV.</li>
            </ul>
            <p>You don&apos;t have to fill in values, beliefs or a handle to use Sovereign. A name to be called by is enough.</p>
          </Block>

          <Block id="public" title="What others see when you take part" lead="Every screen in the app says who can read what you are about to post.">
            <ul>
              <li>
                <strong>A post</strong> — the people you choose when you write it: near you, or as far as everyone on
                Sovereign. It can&apos;t be widened afterwards.
              </li>
              <li>
                <strong>A proposal</strong>, and what you say in its debate — the group or place it is addressed to,
                with your name on it.
              </li>
              <li>
                <strong>That you responded</strong> — on the record. <strong>How</strong> you responded — never, to
                anyone.
              </li>
              <li>
                <strong>Your name, handle and bio</strong> — people who share a group or a local place with you, and
                people you follow or who follow you. There is no directory: you can only be found by your exact handle.
              </li>
              <li>
                <strong>A shared decision page</strong> — anyone with the link: the title, summary, outcome, rationale
                and numbers. Never a name, a response or a note, and no averages under five voices.
              </li>
            </ul>
          </Block>

          <Block id="who" title="Who can see what">
            <Who
              rows={[
                [
                  "Other members",
                  "What was addressed to them: posts, proposals, debate, tallies after close.",
                  "Your private space, your ballot, your follows, your Sphere ratings.",
                ],
                [
                  "Group stewards",
                  "What every member sees. They manage the group: its purpose and values, invitations, a proposal's needs, and whether to share a decision publicly.",
                  "Nothing extra about members — no private space, no ballots. Stewards have no extra read access in the database.",
                ],
                [
                  "Business owners",
                  "Their own listing, review record, campaigns, number of clicks and spend.",
                  "Who clicked, your values, or why their ad was shown to you.",
                ],
                [
                  "Market reviewers",
                  "Business applications and their vetting records, to approve or refuse them.",
                  "Anything in your private space or your ballots.",
                ],
                [
                  "People who run Sovereign",
                  "Technically, anything stored in the database. We don't look.",
                  "Nothing yet is hidden from us by encryption. That is planned, not built.",
                ],
              ]}
            />
          </Block>

          <Block id="ai" title="How AI is used" lead="AI supports a decision. It cannot guarantee that a decision is correct, fair or ethical.">
            <p>
              <strong>Today, no AI model is connected.</strong> Proposals, posts and businesses are read against the
              ten Universal Laws by an offline stand-in that runs on Sovereign&apos;s own servers. It judges structure,
              not meaning, and every reading it writes says that no model read it. Nothing you write is sent to an AI
              company.
            </p>
            <p>
              <strong>When a model is switched on</strong>, the text involved in a reading, or in a conversation with
              your private AI, will be sent to our AI provider (Anthropic) to produce the answer, at the moment you
              use it. This page and the privacy notice will change before that happens.
            </p>
            <p>What holds either way:</p>
            <ul>
              <li>Every reading that decides something is published with its reasons, and anyone it reaches can challenge it. A challenge re-runs it.</li>
              <li>A business is approved only when a person signs the reading off.</li>
              <li>The ten laws are a framework for assessing a proposal. Passing them shows a proposal was checked, not that it is right.</li>
              <li>
                Every law reading is signed by the server and tied to the exact text it read. A forged or stale reading
                is refused, and a proposal is released to people only at 0.618 alignment with the ten laws.
              </li>
            </ul>
          </Block>

          <Block id="control" title="Review, export, delete">
            <ul>
              <li><strong>Download everything</strong> as a standard JSON file: Settings → Your data.</li>
              <li><strong>Delete your account</strong>, at once, from the same screen.</li>
              <li><strong>Edit</strong> your profile, values and private writing yourself, any time.</li>
              <li><strong>Turn sharing off</strong> for your values, <strong>leave</strong> a group, <strong>mute</strong> someone, or <strong>end</strong> a friendship.</li>
              <li><strong>Stop sharing</strong> a decision you shared: the public link stops working.</li>
              <li><strong>Revoke</strong> your proof of personhood. Only you can.</li>
              <li>
                Anything else: <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold hover:underline">{CONTACT_EMAIL}</a>.
              </li>
            </ul>
          </Block>

          <Block id="keep" title="How long we keep it">
            <p>
              Everything is kept while your account exists. When you delete it, everything that is yours alone goes at
              once. Proposals, responses, debate and decisions stay in the record others relied on, shown as written by
              a &ldquo;Former member&rdquo; and no longer linked to your email or name. Deleted data leaves our
              hosting providers&apos; backups as those roll over.
            </p>
          </Block>

          <section id="safeguards" aria-labelledby="safeguards-h" className="scroll-mt-24">
            <h2 id="safeguards-h" className="text-center font-serif text-2xl text-paper sm:text-3xl">
              Safeguards, and their state
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-paper-dim">
              No shield icons. Each safeguard, what it does, and whether it is working in production today.
            </p>
            <StatusLegend className="mt-6" />
            <ul className="mt-6 space-y-3">
              {SAFEGUARDS.map((c) => (
                <CapabilityRow key={c.title} c={c} />
              ))}
            </ul>
          </section>

          <Block id="gaps" title="What we can't promise yet">
            <ul>
              <li>The people who run Sovereign, and our hosting providers, could technically read what is stored.</li>
              <li>The record of decisions is tamper-evident, not tamper-proof. It is not a blockchain and it is not decentralised.</li>
              <li>AI readings come from an offline stand-in until a model is connected.</li>
              <li>Proof of personhood is not confirmed switched on, so proposals at national scale and above may not be able to pass.</li>
            </ul>
            <p>
              Progress is on the <Link href="/explore/roadmap" className="text-gold hover:underline">roadmap</Link>. The
              legal detail — lawful basis, processors, your rights — is in the{" "}
              <Link href="/explore/privacy" className="text-gold hover:underline">privacy notice</Link>.
            </p>
          </Block>
        </div>
      </Section>

      <CtaBand title="See a decision from start to finish." lead="No account needed." />
    </>
  );
}
