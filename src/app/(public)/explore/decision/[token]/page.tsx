import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScoreBar } from "@/components/ui";

import { Container, PrimaryLink, SecondaryLink } from "../../_site/blocks";
import { getSharedDecision, longDate, SCALE_LABEL } from "./data";

/**
 * A shared decision (rule 45). Public, opt-in, nameless.
 *
 * Everything on this page comes from shared_decision(), which returns no
 * person, no response and no note. Below five voices it returns no averages
 * either, and the page says so rather than drawing empty bars.
 */

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const d = await getSharedDecision(token);
  if (!d) return { title: "Decision not shared", robots: { index: false } };
  const verdict = d.outcome === "passed" ? "Passed" : "Did not pass";
  const description = `${verdict} on ${d.voices} ${d.voices === 1 ? "voice" : "voices"}. ${d.summary}`.slice(0, 200);
  return {
    title: d.title,
    description,
    // A link someone chose to send is not a page for search engines to list.
    robots: { index: false, follow: true },
    openGraph: { title: d.title, description, type: "article" },
    twitter: { card: "summary_large_image", title: d.title, description },
  };
}

export default async function SharedDecisionPage({ params }: Props) {
  const { token } = await params;
  const d = await getSharedDecision(token);
  if (!d) notFound();

  const passed = d.outcome === "passed";
  const who = d.by_group ? "A group" : `People in ${SCALE_LABEL[d.scale] ?? "a place"}`;
  const project =
    d.status === "completed" ? "Done: the project is finished." : d.status === "executing" ? "Under way as a project." : null;

  return (
    <section className="py-14 sm:py-20">
      <Container>
        <div className="mx-auto max-w-2xl">
          <p className="smallcaps text-center text-[11px] font-semibold text-paper-faint">
            {who} decided · {longDate(d.decided_on)}
          </p>
          <h1 className="mt-4 text-center font-serif text-4xl leading-[1.08] tracking-tight text-paper sm:text-5xl">{d.title}</h1>
          <p className="mt-5 text-center text-xl leading-snug text-paper-dim">{d.summary}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-pill border px-4 py-1.5 text-base font-semibold ${
                passed ? "border-calm/50 text-calm" : "border-alarm/50 text-alarm"
              }`}
            >
              {passed ? "Passed" : "Did not pass"}
            </span>
            {d.split ? <span className="text-base text-alarm">A split decision</span> : null}
            {project ? <span className="text-base text-paper-dim">{project}</span> : null}
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 border-y border-line py-6">
            <Stat label="Voices" value={String(d.voices)} />
            <Stat
              label={d.members !== null ? "Turnout" : "Scale"}
              value={d.participation !== null ? `${Math.round(d.participation * 100)}%` : (SCALE_LABEL[d.scale] ?? "—")}
            />
            <Stat label="Alignment" value={d.alignment !== null ? d.alignment.toFixed(2) : "—"} />
          </div>

          {d.alignment !== null ? (
            <div className="mt-8 space-y-4">
              <ScoreBar label="Alignment" value={d.alignment} />
              <ScoreBar label="Confidence" value={d.confidence} />
              <ScoreBar label="Urgency" value={d.urgency} />
              {d.spread !== null ? (
                <p className={`text-sm leading-relaxed ${d.split ? "text-alarm" : "text-paper-dim"}`}>
                  {d.split
                    ? `Split: spread ${d.spread.toFixed(2)}, with people at both ends. The average describes two groups, not one.`
                    : `Spread ${d.spread.toFixed(2)}: responses sat close together.`}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-8 text-sm leading-relaxed text-paper-faint">
              Fewer than five voices, so the averages stay private. An average of three is three people&rsquo;s answers.
            </p>
          )}

          {d.rationale ? (
            <div className="mt-10">
              <p className="smallcaps text-[11px] font-semibold text-paper-faint">Why</p>
              <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-paper">{d.rationale}</p>
            </div>
          ) : null}

          <p className="mt-10 text-sm text-paper-faint">
            Shared by the people who decided it. No names, no individual responses, no notes.
          </p>

          <div className="mt-12 rounded-sheet border border-line p-7 text-center sm:p-9">
            <h2 className="font-serif text-2xl leading-tight text-paper sm:text-3xl">Decide like this where you live.</h2>
            <p className="mt-3 text-lg text-paper-dim">Propose. Weigh. Act. Free for people, for good.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <PrimaryLink href="/login">Start free</PrimaryLink>
              <SecondaryLink href="/explore/product#collective">How deciding works</SecondaryLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="smallcaps text-[10px] text-paper-faint">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums text-gold">{value}</p>
    </div>
  );
}
