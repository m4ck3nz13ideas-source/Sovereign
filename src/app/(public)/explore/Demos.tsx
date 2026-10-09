"use client";

import { useMemo, useState } from "react";

/**
 * A demo of each of the five tabs, for visitors. Everything is simulated in
 * the browser — nothing is sent anywhere — and each one shows a real rule of
 * the app working: your private space and AI, the post check and likes that
 * never rank, search with a relevant ad, the market's verification and
 * fit-based ad, and a proposal decided by its own conditions after the law
 * review.
 */

const TABS = [
  { id: "individual", label: "Individual" },
  { id: "home", label: "Home" },
  { id: "search", label: "Search" },
  { id: "market", label: "Market" },
  { id: "collective", label: "Collective" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function Demos() {
  const [tab, setTab] = useState<Tab>("individual");
  return (
    <div className="rounded-3xl border border-line bg-surface-soft p-4 sm:p-6">
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`press shrink-0 rounded-pill px-4 py-2 text-sm font-semibold ${
              tab === t.id ? "bg-gold text-ink" : "border border-line text-paper-dim"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "individual" ? (
        <IndividualDemo />
      ) : tab === "home" ? (
        <HomeDemo />
      ) : tab === "search" ? (
        <SearchDemo />
      ) : tab === "market" ? (
        <MarketDemo />
      ) : (
        <CollectiveDemo />
      )}
    </div>
  );
}

/** Small pill switch used inside a demo. */
function Switch<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`press rounded-pill py-1.5 text-sm ${
            value === o.id ? "border border-gold text-paper" : "border border-line text-paper-faint"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- individual */

const AI_REPLIES: Record<string, string> = {
  plan: "Start with the one thing that would make the week feel lighter. What would that be? I'd block it first and fit the rest around it.",
  idea: "Say it in one sentence first: who it's for and what changes for them. Then we can find the cheapest way to test it this month.",
  vote: "I won't tell you how to vote. But ask yourself: who carries the cost if it goes wrong, and have they had a say?",
};

function IndividualDemo() {
  const [tab, setTab] = useState<"self" | "ideas" | "todo" | "learn" | "vault">("self");
  const [todos, setTodos] = useState([
    { t: "Answer the repair café question", done: false },
    { t: "Read the bus route proposal", done: true },
  ]);
  const [draft, setDraft] = useState("");
  const [chat, setChat] = useState<{ me: string; ai: string } | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 font-serif text-2xl text-gold">
          A
        </div>
        <div>
          <p className="font-serif text-xl text-paper">Alex Rivera</p>
          <p className="text-sm text-paper-dim">Building things that outlast me.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 border-b border-line text-sm">
        {(["self", "ideas", "todo", "learn", "vault"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`pb-2 ${tab === k ? "border-b-2 border-gold text-paper" : "text-paper-faint"}`}
          >
            {k === "todo" ? "To do" : k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>

      <div className="min-h-40 pt-4 text-sm">
        {tab === "self" ? (
          <ul className="space-y-2">
            {[
              ["Community", "People near me should know each other's names."],
              ["Craft", "Make things well, pay people properly."],
              ["Ocean health", "Keep plastic out of the sea."],
            ].map(([n, d]) => (
              <li key={n} className="rounded-2xl border border-line px-3 py-2">
                <span className="text-paper">{n}</span> <span className="text-paper-dim">— {d}</span>
              </li>
            ))}
          </ul>
        ) : tab === "ideas" ? (
          <ul className="space-y-2">
            <li className="rounded-2xl border border-line px-3 py-2 text-paper">Tool library in the old bus shelter</li>
            <li className="rounded-2xl border border-line px-3 py-2 text-paper">Saturday swap shop for kids&apos; clothes</li>
          </ul>
        ) : tab === "todo" ? (
          <div>
            <ul className="space-y-2">
              {todos.map((x, i) => (
                <li key={i} className="flex items-center gap-3">
                  <button
                    aria-label={x.done ? "Mark not done" : "Mark done"}
                    onClick={() => setTodos(todos.map((y, j) => (j === i ? { ...y, done: !y.done } : y)))}
                    className={`h-5 w-5 shrink-0 rounded-full border ${x.done ? "border-gold bg-gold" : "border-line"}`}
                  />
                  <span className={x.done ? "text-paper-faint line-through" : "text-paper"}>{x.t}</span>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) setTodos([...todos, { t: draft.trim(), done: false }]);
                setDraft("");
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a to-do"
                className="min-w-0 flex-1 rounded-full border border-line bg-ink px-3 py-1.5 text-paper outline-none focus:border-gold"
              />
              <button className="text-gold">Add</button>
            </form>
          </div>
        ) : tab === "learn" ? (
          <ul className="space-y-2">
            {[
              ["The need for growth", "Growth drives you most. Feed it well."],
              ["Ecology", "You value Nature. This is the Sphere where it gets decided."],
              ["5. Subsidiarity", "Decisions belong at the smallest scale that can make them well."],
            ].map(([n, d]) => (
              <li key={n} className="rounded-2xl border border-line px-3 py-2">
                <p className="text-paper">{n}</p>
                <p className="text-paper-faint">{d}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            <div className="rounded-2xl border border-line px-3 py-2">
              <p className="font-serif text-2xl tabular-nums text-paper">142 SOV</p>
              <p className="text-paper-faint">earned by answering, deciding and finishing projects</p>
            </div>
            <p className="text-paper-dim">Your identity, data and wallet. Only you can open it.</p>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-paper-faint">Everything here is private to you.</p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Your AI"
          className="press absolute -bottom-1 right-0 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-ink"
        >
          ✦
        </button>
      ) : (
        <div className="mt-4 rounded-2xl border border-gold/40 p-3">
          <div className="flex items-center justify-between">
            <span className="smallcaps text-[10px] text-gold">Your AI · nothing is saved</span>
            <button onClick={() => setOpen(false)} className="text-paper-faint">✕</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ["plan", "Help me plan my week"],
              ["idea", "Sharpen my tool library idea"],
              ["vote", "How should I vote on the bus route?"],
            ].map(([k, q]) => (
              <button
                key={k}
                onClick={() => setChat({ me: q, ai: AI_REPLIES[k] })}
                className="press rounded-pill border border-line px-3 py-1.5 text-xs text-paper-dim"
              >
                {q}
              </button>
            ))}
          </div>
          {chat ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="ml-auto max-w-[85%] rounded-2xl bg-gold px-3 py-2 text-ink">{chat.me}</p>
              <p className="max-w-[85%] rounded-2xl bg-surface px-3 py-2 text-paper">{chat.ai}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- home */

function HomeDemo() {
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const feed = [
    { who: "Priya", text: "First repair café session: fixed 14 things, sent 0 to landfill. Kettle of the day award goes to Mr Okafor's 1978 Russell Hobbs.", likes: 31 },
    { who: "Tom", text: "Tip that saved me £60 this month: the library lends out a thermal camera. Found every draught in the house in ten minutes.", likes: 18 },
  ];
  return (
    <div>
      <PostDemo />
      <p className="smallcaps mt-6 text-[10px] text-paper-faint">Your feed · in time order</p>
      <ul className="mt-2 space-y-3">
        {feed.map((f, i) => (
          <li key={i} className="rounded-2xl border border-line p-4">
            <p className="text-sm font-semibold text-paper">{f.who}</p>
            <p className="mt-1 text-[0.95rem] leading-relaxed text-paper-dim">{f.text}</p>
            <div className="mt-3 flex gap-4 text-sm text-paper-faint">
              <button onClick={() => setLiked({ ...liked, [i]: !liked[i] })} className={liked[i] ? "text-gold" : ""}>
                ♥ {f.likes + (liked[i] ? 1 : 0)}
              </button>
              <span>💬 {4 - i}</span>
            </div>
          </li>
        ))}
        <li className="rounded-2xl border border-gold/40 p-4">
          <div className="flex justify-between">
            <span className="smallcaps text-[10px] text-gold">Sponsored</span>
            <span className="text-xs text-paper-faint">Root &amp; Row</span>
          </div>
          <p className="mt-1 font-serif text-lg text-paper">Veg boxes from farms within 30 miles</p>
          <p className="mt-1 text-xs text-paper-faint">Fits: Local food</p>
        </li>
      </ul>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm">
        <span className="text-paper">Chats</span>
        <span className="text-paper-faint">Priya: see you Saturday 👋</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- search */

const INDEX = [
  { kind: "Proposal", title: "Turn the empty shop into a repair café", tags: ["repair", "shop", "waste", "café"] },
  { kind: "Proposal", title: "Extend the 42 bus to the hospital", tags: ["bus", "transport", "hospital"] },
  { kind: "Post", title: "Repair café: 14 things fixed, 0 to landfill", tags: ["repair", "waste"] },
  { kind: "Word", title: "What 'local' means to the Elm Street group", tags: ["local", "community"] },
  { kind: "Business", title: "Refill Room — bring your own jars", tags: ["waste", "refill", "shop"] },
  { kind: "Business", title: "Root & Row — veg boxes from farms within 30 miles", tags: ["food", "local", "veg"] },
];

function SearchDemo() {
  const [q, setQ] = useState("waste");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = INDEX.filter((x) => words.some((w) => x.tags.some((t) => t.startsWith(w)) || x.title.toLowerCase().includes(w)));
  const ad = hits.find((h) => h.kind === "Business");
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search anything"
        className="w-full rounded-full border border-line bg-ink px-4 py-2.5 text-paper outline-none focus:border-gold"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {["waste", "bus", "local", "repair"].map((w) => (
          <button key={w} onClick={() => setQ(w)} className="press rounded-pill border border-line px-3 py-1 text-xs text-paper-dim">
            {w}
          </button>
        ))}
      </div>
      {ad ? (
        <div className="mt-4 rounded-2xl border border-gold/40 px-4 py-3">
          <span className="smallcaps text-[10px] text-gold">Sponsored · related to “{q}”</span>
          <p className="mt-1 text-paper">{ad.title}</p>
        </div>
      ) : null}
      <ul className="mt-3 divide-y divide-line">
        {hits.length ? (
          hits.map((h) => (
            <li key={h.title} className="flex items-baseline gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs text-paper-faint">{h.kind}</span>
              <span className="text-[0.95rem] text-paper">{h.title}</span>
            </li>
          ))
        ) : (
          <li className="py-3 text-sm text-paper-faint">Nothing yet. Try “bus” or “local”.</li>
        )}
      </ul>
      <p className="mt-3 text-xs text-paper-faint">
        One search across proposals, posts, words and businesses — only what you&apos;re allowed to see. An ad shows only
        when a vetted business is genuinely relevant.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ vote */

// Four neighbours have already responded; how they lean stays hidden until close.
const OTHERS = [0.82, 0.64, 0.9, 0.71];
const NEEDS = { voices: 5, threshold: 0.618, requirement: "Who opens up on Saturday mornings?" };

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
  const [urgency, setUrgency] = useState(0.5);
  const [answered, setAnswered] = useState(false);
  const [closed, setClosed] = useState(false);

  const voices = OTHERS.length + 1;
  const avg = (OTHERS.reduce((s, a) => s + a, 0) + align) / voices;
  const missing: string[] = [];
  if (voices < NEEDS.voices) missing.push(`${NEEDS.voices} voices`);
  if (!answered) missing.push("its open question answered");
  if (avg < NEEDS.threshold) missing.push(`alignment of ${NEEDS.threshold}`);
  const passes = missing.length === 0;

  return (
    <div>
      <p className="font-serif text-xl text-paper">Turn the empty shop on the high street into a repair café.</p>
      <p className="mt-1 text-sm text-paper-faint">Local · checked against the ten laws: no violations</p>

      <div className="mt-4 rounded-2xl border border-line p-3">
        <p className="smallcaps text-[10px] text-paper-faint">What it needs — set by the AI for this proposal</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <p className="text-paper">
            <span className="font-serif text-xl tabular-nums">{voices}</span>
            <span className="text-paper-faint"> / {NEEDS.voices} voices</span>
          </p>
          <p className="text-paper-dim">Open 3 days</p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 text-sm">
          <span className="text-paper">{NEEDS.requirement}</span>
          {answered ? (
            <span className="shrink-0 text-calm">Answered</span>
          ) : (
            <button onClick={() => setAnswered(true)} className="shrink-0 text-gold hover:underline">
              Answer
            </button>
          )}
        </div>
        {answered ? (
          <p className="mt-1 text-xs text-paper-dim">“Priya and Tom, alternating weeks — keys at the bakery.”</p>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        <Slider label="Does it feel right?" value={align} onChange={setAlign} />
        <Slider label="Will it work?" value={conf} onChange={setConf} />
        <Slider label="How much does it matter now?" value={urgency} onChange={setUrgency} />
      </div>

      {!closed ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-paper-faint">Nobody sees which way it leans until it closes.</p>
          <button
            onClick={() => setClosed(true)}
            className="press shrink-0 rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-ink"
          >
            Close it
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line p-4">
          <p className={`font-serif text-2xl ${passes ? "text-calm" : "text-alarm"}`}>
            {passes ? "Passed." : "Not yet."}
          </p>
          <p className="mt-2 text-sm text-paper-dim">
            Alignment {avg.toFixed(2)} (needs {NEEDS.threshold}) · {voices} of {NEEDS.voices} voices
          </p>
          <p className="mt-2 text-sm text-paper-faint">
            {passes
              ? "It becomes a project, with the people who offered to help."
              : `Still needs ${missing.join(" and ")}. Nobody lost — it gets better and comes back.`}
          </p>
          <button onClick={() => setClosed(false)} className="mt-3 text-sm text-gold hover:underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function CollectiveDemo() {
  const [v, setV] = useState<"decide" | "law">("decide");
  return (
    <div>
      <Switch
        options={[
          { id: "decide", label: "Decide" },
          { id: "law", label: "Law check" },
        ]}
        value={v}
        onChange={setV}
      />
      {v === "decide" ? <VoteDemo /> : <ReviewDemo />}
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

/* ------------------------------------------------------------------ post */

const SAMPLES = [
  "Planted forty hedging whips along the school fence this morning with the kids.",
  "50% OFF today only!! Click the link in my bio to buy now.",
  "Apparently the council is secretly selling the park. Share before it gets deleted!",
];

function readPost(text: string): { ok: boolean; why: string } {
  const t = text.toLowerCase();
  if (/(buy now|% off|discount|link in (my )?bio|subscribe|dm me to order)/.test(t))
    return { ok: false, why: "This is selling. Businesses reach people through the Market." };
  if (/(apparently|i heard|they say|share before|wake up|everyone knows)/.test(t))
    return { ok: false, why: "A claim passed on as fact, written to spread. Say what you saw, or where it comes from." };
  if (t.trim().length < 15) return { ok: false, why: "Say a little more." };
  return { ok: true, why: "True to you, or useful to others — and told straight." };
}

function PostDemo() {
  const [text, setText] = useState(SAMPLES[0]);
  const [result, setResult] = useState<{ ok: boolean; why: string } | null>(null);
  const [liked, setLiked] = useState(false);
  return (
    <div>
      <p className="text-sm text-paper-dim">Post anything that is true to you or useful to others. Try one:</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLES.map((s, i) => (
          <button
            key={i}
            onClick={() => {
              setText(s);
              setResult(null);
            }}
            className="press rounded-pill border border-line px-3 py-1.5 text-xs text-paper-dim"
          >
            Example {i + 1}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={3}
        className="mt-3 w-full rounded-2xl border border-line bg-ink px-3.5 py-3 text-[0.95rem] text-paper outline-none focus:border-gold"
      />
      <button
        onClick={() => setResult(readPost(text))}
        className="press mt-3 rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-ink"
      >
        Post
      </button>

      {result && !result.ok ? (
        <p className="mt-4 rounded-2xl border border-alarm/40 px-4 py-3 text-sm text-alarm">{result.why}</p>
      ) : null}
      {result && result.ok ? (
        <div className="mt-4 rounded-2xl border border-line p-4">
          <p className="text-[0.95rem] leading-relaxed text-paper">{text}</p>
          <div className="mt-3 flex items-center gap-4 text-sm text-paper-faint">
            <button onClick={() => setLiked(!liked)} className={liked ? "text-gold" : ""}>
              ♥ {12 + (liked ? 1 : 0)}
            </button>
            <span>💬 3</span>
          </div>
          <p className="mt-3 text-xs text-paper-faint">Likes are shown, never used to rank. Your feed stays in time order.</p>
        </div>
      ) : null}
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

function BuyDemo() {
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

const SELL_STEPS = [
  ["Describe your business", "What you do, and your evidence: how you treat people, what you use, where it comes from."],
  ["AI reads it against the ten laws", "A violation keeps you out. Tensions go to a reviewer to check."],
  ["Prove it's you", "Add a code to your website. A UK company can add its Companies House number."],
  ["A reviewer signs it off", "Approved, for exactly what you wrote. Edit it and it's read again."],
  ["List and advertise", "Products and services link to your shop. Ads are paid per click — and shown by fit, never by bid."],
];

function SellDemo() {
  const [step, setStep] = useState(0);
  return (
    <div>
      <ol className="space-y-2">
        {SELL_STEPS.map(([t, d], i) => (
          <li
            key={t}
            className={`rounded-2xl border px-4 py-3 ${i === step ? "border-gold" : i < step ? "border-line opacity-70" : "border-line opacity-40"}`}
          >
            <p className="text-[0.95rem] text-paper">
              <span className={i < step ? "text-calm" : "text-paper-faint"}>{i < step ? "✓" : i + 1}</span> {t}
            </p>
            {i === step ? <p className="mt-1 text-sm text-paper-dim">{d}</p> : null}
          </li>
        ))}
      </ol>
      <button
        onClick={() => setStep(step >= SELL_STEPS.length - 1 ? 0 : step + 1)}
        className="press mt-4 rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-ink"
      >
        {step >= SELL_STEPS.length - 1 ? "Start again" : "Next"}
      </button>
      <p className="mt-3 text-xs text-paper-faint">Paying can buy visibility. It can never buy approval.</p>
    </div>
  );
}

function MarketDemo() {
  const [m, setM] = useState<"buy" | "sell">("buy");
  return (
    <div>
      <Switch
        options={[
          { id: "buy", label: "Buy" },
          { id: "sell", label: "Sell" },
        ]}
        value={m}
        onChange={setM}
      />
      {m === "buy" ? <BuyDemo /> : <SellDemo />}
    </div>
  );
}
