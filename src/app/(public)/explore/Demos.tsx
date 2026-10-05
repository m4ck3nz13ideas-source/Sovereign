"use client";

import { useMemo, useState } from "react";

/**
 * Three demos a visitor can play with before signing in. Everything here is
 * simulated in the browser — nothing is sent anywhere — and each one shows a
 * real rule of the app working, with the same numbers the app uses.
 */

const TABS = [
  { id: "vote", label: "Vote" },
  { id: "review", label: "AI review" },
  { id: "market", label: "Market" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function Demos() {
  const [tab, setTab] = useState<Tab>("vote");
  return (
    <div className="rounded-3xl border border-line bg-surface-soft p-4 sm:p-6">
      <div className="mb-5 flex gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`press rounded-pill px-4 py-2 text-sm font-semibold ${
              tab === t.id ? "bg-gold text-ink" : "border border-line text-paper-dim"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "vote" ? <VoteDemo /> : tab === "review" ? <ReviewDemo /> : <MarketDemo />}
    </div>
  );
}

/* ------------------------------------------------------------------ vote */

const OTHERS = [
  { a: 0.82, w: 0.7 },
  { a: 0.64, w: 0.4 },
  { a: 0.9, w: 0.8 },
  { a: 0.55, w: 0.3 },
];

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-paper">{label}</span>
        <span className="tabular-nums text-paper-dim">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-gold)]"
      />
    </label>
  );
}

function VoteDemo() {
  const [align, setAlign] = useState(0.7);
  const [conf, setConf] = useState(0.6);
  const [will, setWill] = useState(0.5);
  const [closed, setClosed] = useState(false);

  const avgA = (OTHERS.reduce((s, o) => s + o.a, 0) + align) / (OTHERS.length + 1);
  const avgW = (OTHERS.reduce((s, o) => s + o.w, 0) + will) / (OTHERS.length + 1);
  const passes = avgA >= 0.7 && avgW >= 0.5;

  return (
    <div>
      <p className="font-serif text-xl text-paper">Turn the empty shop on the high street into a repair café.</p>
      <p className="mt-1 text-sm text-paper-faint">Local · 5 people responding</p>

      <div className="mt-5 space-y-4">
        <Slider label="Does it feel right?" value={align} onChange={setAlign} />
        <Slider label="Will it work?" value={conf} onChange={setConf} />
        <Slider label="Will you help make it happen?" value={will} onChange={setWill} />
      </div>

      {!closed ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-paper-faint">How everyone else leans stays hidden until it closes.</p>
          <button
            onClick={() => setClosed(true)}
            className="press shrink-0 rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-ink"
          >
            Close the vote
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line p-4">
          <p className={`font-serif text-2xl ${passes ? "text-calm" : "text-alarm"}`}>
            {passes ? "Passed." : "Not yet."}
          </p>
          <p className="mt-2 text-sm text-paper-dim">
            Alignment {avgA.toFixed(2)} (needs 0.70) · Willingness {avgW.toFixed(2)} (needs 0.50)
          </p>
          <p className="mt-2 text-sm text-paper-faint">
            {passes
              ? "It becomes a project, with people who said they would help."
              : "Nobody lost. The idea gets better and comes back."}
          </p>
          <button onClick={() => setClosed(false)} className="mt-3 text-sm text-gold hover:underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- review */

const PROPOSALS = [
  {
    title: "Ban dogs from the park to keep the grass nice.",
    readings: [
      { law: "Sovereignty of the Individual", verdict: "tension", why: "Restricts every dog owner for an aesthetic gain. Is there a smaller rule that would do?" },
      { law: "Harmony of Diversity", verdict: "tension", why: "Dog walkers are a large share of park users and were not asked." },
      { law: "Subsidiarity", verdict: "aligned", why: "A local park, decided locally." },
    ],
  },
  {
    title: "Plant 200 fruit trees on council verges, free to pick.",
    readings: [
      { law: "Stewardship of Earth", verdict: "aligned", why: "Adds habitat and food with almost no upkeep." },
      { law: "Equity & Justice", verdict: "aligned", why: "Free to anyone who walks past." },
      { law: "Reciprocity & Mutual Care", verdict: "tension", why: "Who clears fallen fruit? Name it before it passes." },
    ],
  },
  {
    title: "Fund the youth club by charging non-residents to park.",
    readings: [
      { law: "Equity & Justice", verdict: "violation", why: "Puts the whole cost on people who have no say in the decision." },
      { law: "Truth & Transparency", verdict: "aligned", why: "Costs and beneficiaries are stated plainly." },
      { law: "Right Use of Power", verdict: "tension", why: "Charges people outside the group making the rule." },
    ],
  },
];

const TONE: Record<string, string> = {
  aligned: "text-calm",
  tension: "text-gold",
  violation: "text-alarm",
};

function ReviewDemo() {
  const [i, setI] = useState(0);
  const p = PROPOSALS[i];
  const blocked = p.readings.some((r) => r.verdict === "violation");
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PROPOSALS.map((q, k) => (
          <button
            key={k}
            onClick={() => setI(k)}
            className={`press rounded-pill px-3 py-1.5 text-xs ${
              k === i ? "border border-gold text-paper" : "border border-line text-paper-faint"
            }`}
          >
            Proposal {k + 1}
          </button>
        ))}
      </div>
      <p className="mt-4 font-serif text-xl text-paper">{p.title}</p>
      <ul className="mt-4 space-y-3">
        {p.readings.map((r) => (
          <li key={r.law} className="rounded-2xl border border-line px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-paper">{r.law}</span>
              <span className={`smallcaps text-[11px] ${TONE[r.verdict]}`}>{r.verdict}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-paper-dim">{r.why}</p>
          </li>
        ))}
      </ul>
      <p className={`mt-4 text-sm ${blocked ? "text-alarm" : "text-paper-dim"}`}>
        {blocked
          ? "A violation stops it before anyone votes. Fix it, and it is read again."
          : "Tensions get answered on the record. Then everyone votes, knowing the trade-offs."}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- market */

const VALUES = ["Ocean health", "Fair pay", "Local food", "Zero waste"];

const BUSINESSES = [
  { name: "Tideline Recovery", line: "Benches made from ocean plastic.", tags: ["Ocean health", "Zero waste"], bid: 10 },
  { name: "Fairway Bank", line: "Banking that funds no weapons.", tags: ["Fair pay"], bid: 500 },
  { name: "Root & Row", line: "Veg boxes from farms within 30 miles.", tags: ["Local food", "Fair pay"], bid: 40 },
  { name: "Refill Room", line: "Bring your own jars. Pay by weight.", tags: ["Zero waste", "Local food"], bid: 25 },
];

function MarketDemo() {
  const [mine, setMine] = useState<string[]>(["Ocean health"]);
  const ranked = useMemo(
    () =>
      [...BUSINESSES]
        .map((b) => ({ ...b, fit: b.tags.filter((t) => mine.includes(t)).length }))
        .sort((a, b) => b.fit - a.fit || b.bid - a.bid),
    [mine],
  );
  const top = ranked[0];
  return (
    <div>
      <p className="text-sm text-paper-dim">Pick what you care about.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {VALUES.map((v) => {
          const on = mine.includes(v);
          return (
            <button
              key={v}
              onClick={() => setMine(on ? mine.filter((x) => x !== v) : [...mine, v])}
              className={`press rounded-pill px-3 py-1.5 text-sm ${
                on ? "bg-gold text-ink" : "border border-line text-paper-dim"
              }`}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-gold/40 p-4">
        <div className="flex items-center justify-between">
          <span className="smallcaps text-[10px] text-gold">Sponsored</span>
          <span className="text-xs text-paper-faint">bid {top.bid}p a click</span>
        </div>
        <p className="mt-1.5 font-serif text-xl text-paper">{top.name}</p>
        <p className="mt-1 text-sm text-paper-dim">{top.line}</p>
        {top.fit ? <p className="mt-2 text-xs text-paper-faint">Fits: {top.tags.filter((t) => mine.includes(t)).join(", ")}</p> : null}
      </div>
      <p className="mt-3 text-sm text-paper-faint">
        The ad you see is the best fit for you — not the biggest bid. Fairway bids 50× more and only wins when nothing fits better.
      </p>
    </div>
  );
}
