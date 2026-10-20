"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { RESONANCE_THRESHOLD, UNIVERSAL_LAWS, type LawId } from "@/lib/universal-law";

/**
 * The sample decision, one stage at a time.
 *
 * The stages are the ones a proposal moves through in the app — proposed,
 * alignment, vote, activation, reflection — and each says what is happening,
 * who can take part, which rule applies, what comes next and what could stop
 * it. All content is invented. The visitor's own response is kept in this
 * component's memory and nowhere else.
 */

type Stage = {
  id: string;
  name: string;
  happening: string;
  who: string;
  rule: string;
  next: string;
  couldStop: string;
  body: ReactNode;
};

const VERDICTS: Partial<Record<LawId, { verdict: "tension"; why: string }>> = {
  equity_and_justice: {
    verdict: "tension",
    why: "The youth club's roof gets £4,000 against a £6,000 quote. The people who use it most are under 18 and cannot respond here.",
  },
  stewardship_of_earth: {
    verdict: "tension",
    why: "New lights along a canal can disturb bats. The proposal says the lights dim after midnight but not how.",
  },
};

// Twenty-one invented responses: alignment only, from 0 to 1. Not a clean win.
const RESPONSES = [0.95, 0.9, 0.9, 0.85, 0.85, 0.85, 0.8, 0.8, 0.8, 0.75, 0.75, 0.7, 0.65, 0.6, 0.55, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1];

const NOTES = [
  "The path is the only way to the station after dark. I stopped using it last winter.",
  "The roof is leaking now. Lights can wait a year; water damage can't.",
  "Agree, but please put the timer on the record before the money moves.",
  "I'd rather split it evenly. This feels like the louder group winning.",
];

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sd(xs: number[]) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function Example({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-gold-dim bg-gold-wash p-4 text-sm leading-relaxed text-paper">
      <span className="font-semibold">Example data.</span> {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-line p-5">
      <h4 className="font-semibold text-paper">{title}</h4>
      <div className="mt-2 space-y-2 leading-relaxed text-paper-dim">{children}</div>
    </div>
  );
}

function Range({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm text-paper">
        {label}
        <span className="tabular-nums text-paper-dim">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-gold)]"
      />
    </label>
  );
}

export function Walkthrough() {
  const [i, setI] = useState(0);
  const [mine, setMine] = useState(0.5);
  const [sent, setSent] = useState(false);

  const all = sent ? [...RESPONSES, mine] : RESPONSES;
  const avg = mean(all);
  const spread = sd(all);
  const against = all.filter((x) => x < 0.5).length;

  const stages: Stage[] = [
    {
      id: "proposed",
      name: "Proposed",
      happening: "A member writes the problem, the change, its cost and who it affects, and submits it to the neighbourhood.",
      who: "Any member can propose. Drafts stay on their own device until they submit.",
      rule: "A proposal has six sections and is sharpened before submission. Once submitted, the text is fixed.",
      next: "It is read against the ten Universal Laws and given its conditions.",
      couldStop: "The author can withdraw it, in writing, at any point before it closes.",
      body: (
        <div className="space-y-4">
          <Card title="The problem">
            <p>
              Elmfield (an invented neighbourhood) has £12,000 left in its shared fund this year. The canal path to
              the station has no lighting and people avoid it after dark. The youth club roof leaks, with a repair
              quote of £6,000.
            </p>
          </Card>
          <Card title="The question being decided">
            <p className="text-paper">
              Spend £8,000 on lighting the canal path, with lights that dim after midnight, and £4,000 towards the
              youth club roof?
            </p>
          </Card>
          <Card title="What it gives up">
            <p>The roof gets £2,000 less than its quote and stays partly unfunded. Lighting means running costs every year.</p>
          </Card>
        </div>
      ),
    },
    {
      id: "alignment",
      name: "Alignment",
      happening: "The proposal is read against each of the ten Universal Laws, and its own conditions are set: how many voices, who must be reached, which questions must be answered.",
      who: "Everyone it is addressed to can read the reading and the conditions, with reasons, and can challenge them.",
      rule: "A violation of any law ends the proposal, whatever the vote. Tension does not; it is published so people weigh it.",
      next: "Once conditions exist, people who have read it can respond.",
      couldStop: "A violation. A challenge never stalls a proposal — it re-runs the reading and the argument goes on the record.",
      body: (
        <div className="space-y-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {UNIVERSAL_LAWS.map((l) => {
              const v = VERDICTS[l.id];
              return (
                <li key={l.id} className="rounded-card border border-line p-3">
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-paper">
                      {l.ordinal}. {l.name}
                    </span>
                    <span className={`shrink-0 font-semibold ${v ? "text-gold" : "text-calm"}`}>{v ? "Tension" : "Aligned"}</span>
                  </p>
                  {v ? <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">{v.why}</p> : null}
                </li>
              );
            })}
          </ul>
          <Card title="Conditions set for this proposal">
            <ul className="ml-5 list-disc space-y-1.5">
              <li>At least 15 voices.</li>
              <li>Reached on the record: youth club parents, and households along the canal.</li>
              <li>Answered on the record before it can pass: how and when will the lights dim, to protect bats?</li>
              <li>No fixed closing date: it stays open until these are met.</li>
            </ul>
          </Card>
          <Example>
            In the app today, readings like this come from an offline stand-in that judges structure, not meaning,
            and says so on every reading. Passing the laws shows a proposal was checked, not that it is right.
          </Example>
        </div>
      ),
    },
    {
      id: "vote",
      name: "Vote",
      happening: "People who have read the proposal respond: does it feel right, will it work, how much does it matter now.",
      who: "Members it is addressed to, who have opened it. Nobody can respond to a proposal they haven't read.",
      rule: "Responses are secret, and the running result stays hidden. Meeting the conditions lets it be decided; the responses decide whether it passes — average alignment must reach 0.618.",
      next: "When every condition is met, it can be decided, and the result is published.",
      couldStop: "Conditions not yet met (too few voices, a requirement unanswered) — then it waits. Alignment below 0.618 — then it does not pass, even with every condition met.",
      body: (
        <div className="space-y-4">
          <Card title="Try responding">
            <Range label="Does it feel right?" value={mine} onChange={(v) => { setMine(v); setSent(false); }} />
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSent(true)}
                className="press rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-ink"
              >
                {sent ? "Added to the example" : "Add mine to the example"}
              </button>
              <span className="text-sm text-paper-faint">
                {sent ? "Kept in this page only. Nothing is sent or saved." : "Not sent anywhere."}
              </span>
            </div>
          </Card>
          <Card title="What everyone sees while it is open">
            <p>
              <span className="font-serif text-2xl tabular-nums text-paper">{all.length}</span> responses. No average,
              no lean, no names. Just a count.
            </p>
          </Card>
          <Example>The other twenty-one responses on this page are invented.</Example>
        </div>
      ),
    },
    {
      id: "decided",
      name: "Decision",
      happening: "The proposal closes. Every response's numbers are shown, sorted, without names, with the spread.",
      who: "Everyone it was addressed to. A steward may also share it with a public link that shows no names.",
      rule: "A split is never reported as a consensus: every decision carries its spread.",
      next: "If it passed, people offer to take on its needs.",
      couldStop: "Passing is not activation. Nothing happens until someone takes on each need.",
      body: (
        <div className="space-y-4">
          <Card title={avg >= RESONANCE_THRESHOLD ? "Passed — narrowly, and not unanimously" : "Did not pass"}>
            <p>
              Alignment <span className="font-semibold tabular-nums text-paper">{avg.toFixed(2)}</span> against a
              threshold of {RESONANCE_THRESHOLD}. Spread <span className="tabular-nums">{spread.toFixed(2)}</span>.{" "}
              {against} of {all.length} responses leaned against.
            </p>
            <div className="mt-3 flex h-16 items-end gap-1" role="img" aria-label={`${all.length} responses, sorted, from ${Math.min(...all).toFixed(2)} to ${Math.max(...all).toFixed(2)}`}>
              {[...all].sort((a, b) => b - a).map((x, k) => (
                <span
                  key={k}
                  className={`flex-1 rounded-t-sm ${x >= 0.5 ? "bg-paper-dim" : "border border-paper-faint bg-transparent"}`}
                  style={{ height: `${Math.max(6, x * 100)}%` }}
                />
              ))}
            </div>
            <p className="text-xs text-paper-faint">Each bar is one response, without a name. Outlined bars leaned against.</p>
          </Card>
          {avg < RESONANCE_THRESHOLD ? (
            <Example>
              Your response tipped this example below the threshold. In the app it would not go ahead; the rest of
              this walkthrough carries on as if it had passed, to show the later stages.
            </Example>
          ) : null}
          <Card title="Conditions, met">
            <ul className="ml-5 list-disc space-y-1.5">
              <li>{all.length} voices, against 15 needed.</li>
              <li>Youth club parents and canal households marked reached, with how and when.</li>
              <li>
                Answered on the record: &ldquo;Lights at 30% from midnight to 5am, agreed with the canal trust&apos;s
                ecologist.&rdquo;
              </li>
            </ul>
          </Card>
          <Card title="Notes, without names">
            <ul className="ml-5 list-disc space-y-1.5">
              {NOTES.map((n) => (
                <li key={n}>&ldquo;{n}&rdquo;</li>
              ))}
            </ul>
          </Card>
          <Example>Invented people, invented numbers. No real vote took place.</Example>
        </div>
      ),
    },
    {
      id: "activation",
      name: "Activation",
      happening: "The passed proposal becomes a project once every need has a named person against it.",
      who: "Anyone it reached can offer to take on a need. The steward or author lists the needs.",
      rule: "Ratification is not activation: a project is created only when every need is covered.",
      next: "The work is done, and a reflection is written.",
      couldStop: "An uncovered need. A passed proposal that is not going ahead must say why, in writing.",
      body: (
        <Card title="Needs">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>A quote and installer for the lights — taken by a resident who is an electrician.</li>
            <li>Permission from the canal trust — taken by the association&apos;s secretary.</li>
            <li>A plan for the remaining £2,000 for the roof — taken by two youth club parents.</li>
          </ul>
        </Card>
      ),
    },
    {
      id: "reflection",
      name: "Reflection",
      happening: "Six months later, someone writes down what actually happened, and predictions made at the time are marked.",
      who: "The people on the project write it. Everyone it reached can read it.",
      rule: "A project cannot be completed without a reflection of at least eighty characters, and due predictions must be marked.",
      next: "The lesson is carried into the next decision of its kind.",
      couldStop: "Nothing — a disappointing outcome is still recorded.",
      body: (
        <div className="space-y-4">
          <Card title="What happened">
            <p>
              The lights went in a month late. The dimming timer was set wrongly for the first eight weeks, and was
              fixed after a resident raised it. More people use the path after dark. The youth club raised the
              missing £2,000 itself, but only after another winter of leaks.
            </p>
          </Card>
          <Card title="Predictions, marked">
            <ul className="ml-5 list-disc space-y-1.5">
              <li>&ldquo;More people will use the path after dark within three months.&rdquo; — <span className="text-calm">Right.</span></li>
              <li>&ldquo;The roof can wait a year without more damage.&rdquo; — <span className="text-alarm">Wrong.</span></li>
            </ul>
          </Card>
          <Example>The outcome is invented too, and deliberately mixed: decisions rarely go exactly to plan.</Example>
        </div>
      ),
    },
  ];

  const s = stages[i];

  return (
    <div className="mx-auto max-w-4xl">
      <div role="note" className="mb-8 rounded-card border border-gold-dim bg-gold-wash p-4 text-center text-paper">
        <strong>Illustrative example.</strong> Elmfield, its people and every response are invented. Nothing here is
        a real vote, and nothing you do on this page is sent or saved.
      </div>

      <nav aria-label="Stages of the sample decision">
        <ol className="flex flex-wrap justify-center gap-2">
          {stages.map((st, k) => (
            <li key={st.id}>
              <button
                type="button"
                onClick={() => setI(k)}
                aria-current={k === i ? "step" : undefined}
                className={`press rounded-pill px-3.5 py-1.5 text-sm font-semibold ${
                  k === i ? "bg-gold text-ink" : k < i ? "border border-line text-paper" : "border border-line text-paper-dim"
                }`}
              >
                <span className="tabular-nums">{k + 1}</span>. {st.name}
                {k < i ? <span className="sr-only"> (seen)</span> : null}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="stage-h" className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <p className="smallcaps text-center text-[11px] font-semibold text-gold lg:text-left">
            Stage {i + 1} of {stages.length}
          </p>
          <h2 id="stage-h" className="mt-2 text-center font-serif text-3xl text-paper lg:text-left">
            {s.name}
          </h2>
          <dl className="mt-6 space-y-4 text-[0.95rem] leading-relaxed">
            {(
              [
                ["What is happening", s.happening],
                ["Who can take part", s.who],
                ["Which rule applies", s.rule],
                ["What happens next", s.next],
                ["What could stop it", s.couldStop],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="font-semibold text-paper">{k}</dt>
                <dd className="mt-0.5 text-paper-dim">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>{s.body}</div>
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <button
          type="button"
          onClick={() => setI((k) => Math.max(0, k - 1))}
          disabled={i === 0}
          className="press rounded-pill border border-line px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40"
        >
          Back
        </button>
        {i < stages.length - 1 ? (
          <button
            type="button"
            onClick={() => setI((k) => Math.min(stages.length - 1, k + 1))}
            className="press rounded-pill bg-gold px-5 py-2 text-sm font-semibold text-ink"
          >
            Next: {stages[i + 1].name}
          </button>
        ) : (
          <p className="text-sm text-paper-dim">
            That is the whole loop. In the app you could{" "}
            <Link href="/login" className="text-gold hover:underline">
              join or start a group
            </Link>
            , read a real proposal, and respond to it — or check{" "}
            <Link href="/explore#today" className="text-gold hover:underline">
              what works today
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
