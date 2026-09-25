"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button, Card, Field, Tag, inputClass } from "@/components/ui";
import { READINESS_THRESHOLD } from "@/lib/readiness";

import { assessDraft, submitProposal } from "../../actions";

const DRAFT_KEY = "sovereign.draft.proposal";

const EMPTY = {
  title: "",
  summary: "",
  intent: "",
  change: "",
  constraints: "",
  risks: "",
  alternatives: "",
  evidence: "",
  category: "",
  budget: "",
  termDays: "",
};

/** The compose form's own shape, without the id that identifies the original. */
function stripId(t: typeof EMPTY & { id: string }): typeof EMPTY {
  const rest = { ...t } as typeof EMPTY & { id?: string };
  delete rest.id;
  return rest;
}

type Sharpening = {
  sections: { section: string; ready: boolean; note: string; questions: string[] }[];
  readiness: number;
  verdict: string;
};

const SECTIONS: {
  key: keyof typeof EMPTY;
  label: string;
  hint: string;
  rows: number;
}[] = [
  {
    key: "intent",
    label: "What this is solving",
    hint: "The problem, not the solution. What is going wrong now, and for whom? A proposal that describes a fix without naming the problem is the most common way one fails.",
    rows: 5,
  },
  {
    key: "change",
    label: "What would change",
    hint: "The day after this happened, what is different? Concrete enough that somebody who was not in the room could carry it out.",
    rows: 5,
  },
  {
    key: "constraints",
    label: "What it takes",
    hint: "Money, time, people — with numbers — and anything it depends on that is not yours to decide.",
    rows: 4,
  },
  {
    key: "risks",
    label: "What could go wrong",
    hint: "What you are unsure about, and what you would take, three months in, as evidence that it is not working.",
    rows: 4,
  },
  {
    key: "alternatives",
    label: "What else you considered",
    hint: "Including doing nothing, which is a real option and often the right one. Say why not that.",
    rows: 4,
  },
  {
    key: "evidence",
    label: "Evidence — optional",
    hint: "Where a claim here is doing real work, what supports it.",
    rows: 3,
  },
];

/**
 * Drafts live here, in this browser, and nowhere else.
 *
 * Private first, made structural: a half-formed idea should not be visible to
 * anyone, should not be in the shared database, and should not be recoverable
 * by anyone but its author. The cost is that a draft does not follow you
 * between devices, which is the right trade for something you have not decided
 * to say yet.
 *
 * The sharpening pass is the one exception, and a narrow one: it records a
 * score, what is still unanswered, and a hash of the text — never the text.
 * That row is the author's alone until a proposal attaches it.
 */
export function ComposeProposal({
  addresses,
  defaultAddress,
  unsetScopes,
  takingUp,
}: {
  addresses: { value: string; label: string; detail: string | null }[];
  defaultAddress: string;
  /** Scales this person has not said where they are, so cannot yet propose to. */
  unsetScopes: string[];
  /**
   * A dormant proposal being taken up again. Its words come across; nothing
   * else does. The sharpening and the audit run again from scratch, and the
   * new proposal records what it came from.
   */
  takingUp: (typeof EMPTY & { id: string }) | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(
    takingUp
      ? { ...EMPTY, ...stripId(takingUp), address: defaultAddress }
      : { ...EMPTY, address: defaultAddress },
  );
  const [restored, setRestored] = useState(false);
  const [sharp, setSharp] = useState<Sharpening | null>(null);
  const [sharpOf, setSharpOf] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Reading browser storage has to wait for mount: the server cannot see it,
  // so initialising state from it would desynchronise hydration. A draft that
  // is being taken up from a dormant proposal wins over a stored one — it was
  // asked for explicitly, a moment ago.
  useEffect(() => {
    if (takingUp) return;
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        /* eslint-disable react-hooks/set-state-in-effect */
        setForm((f) => ({ ...f, ...draft }));
        setRestored(true);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // A browser that refuses storage just means no draft recovery.
    }
  }, [takingUp]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (form.title || form.intent || form.change) {
          window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        }
      } catch {
        // Ignore: the draft is a convenience, not a guarantee.
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [form]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // A sharpening is about one exact draft. Change a word and it no longer
  // applies — the database checks the same thing with a hash, so the button
  // going quiet here is the interface telling the truth, not guarding.
  const fingerprint = JSON.stringify([
    form.intent,
    form.change,
    form.constraints,
    form.risks,
    form.alternatives,
    form.evidence,
  ]);
  const stale = Boolean(sharp) && sharpOf !== fingerprint;
  const ready = Boolean(sharp) && !stale && (sharp?.readiness ?? 0) >= READINESS_THRESHOLD;

  function sharpen() {
    start(async () => {
      setError(null);
      const r = await assessDraft({ ...form, supersedes: takingUp?.id ?? null });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSharp(r.sharpen);
      setSharpOf(fingerprint);
    });
  }

  function submit() {
    start(async () => {
      setError(null);
      const r = await submitProposal({ ...form, supersedes: takingUp?.id ?? null });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to clean up.
      }
      router.push(`/connection/proposals/${r.id}`);
    });
  }

  function discard() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing to clean up.
    }
    setForm({ ...EMPTY, address: defaultAddress });
    setSharp(null);
    setRestored(false);
  }

  return (
    <div className="space-y-5">
      {restored ? (
        <p className="smallcaps rounded-md border border-line bg-surface-soft px-3 py-2 text-[10px] text-paper-faint">
          a draft was waiting in this browser
        </p>
      ) : null}

      {takingUp ? (
        <p className="rounded-md border border-gold-dim bg-gold-wash px-3 py-2.5 text-sm leading-relaxed text-paper-dim">
          This is a second attempt, and it starts from the first one&rsquo;s
          words and nothing else. Whatever went wrong the first time — nobody
          responded, or nobody committed what it needed — the fix goes in the
          text, not in the record. It will be sharpened and audited again.
        </p>
      ) : null}

      <Field
        label="Who this is for"
        hint="The lowest scale that can actually decide it. Something your street can settle does not belong in front of a country."
      >
        <select
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          className={inputClass}
        >
          {addresses.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
              {a.detail ? ` — ${a.detail}` : ""}
            </option>
          ))}
        </select>
      </Field>

      {unsetScopes.length ? (
        <p className="text-xs leading-relaxed text-paper-faint">
          You can propose at any scale you are in. {unsetScopes.join(", ")}{" "}
          {unsetScopes.length === 1 ? "is" : "are"} missing only because you
          have not said where you are there —{" "}
          <Link href="/settings/place" className="text-gold hover:underline">
            add it
          </Link>{" "}
          and it appears here.
        </p>
      ) : null}

      <Field label="Title">
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Bollards at the north end of the alley"
          className={inputClass}
        />
      </Field>

      <Field
        label="In one line"
        hint="What you would tell somebody who missed the conversation."
      >
        <input
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          className={inputClass}
        />
      </Field>

      {SECTIONS.map((s) => {
        const reading = sharp?.sections.find((x) => x.section === s.key);
        return (
          <div key={s.key}>
            <Field label={s.label} hint={s.hint}>
              <textarea
                value={form[s.key]}
                onChange={(e) => set(s.key, e.target.value)}
                rows={s.rows}
                className={`${inputClass} resize-y leading-relaxed`}
              />
            </Field>

            {reading && !stale ? (
              <div
                className={`mt-2 rounded-md border px-3 py-2.5 ${
                  reading.ready
                    ? "border-calm/30 bg-calm/5"
                    : "border-gold-dim bg-gold-wash"
                }`}
              >
                <p className="text-sm leading-relaxed text-paper-dim">
                  {reading.note}
                </p>
                {reading.questions.length ? (
                  <ul className="mt-2 space-y-1">
                    {reading.questions.map((q, i) => (
                      <li key={i} className="text-sm leading-relaxed text-paper">
                        — {q}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" hint="Optional.">
          <input
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="Space, Money, Practice…"
            className={inputClass}
          />
        </Field>

        <Field label="Budget" hint="A number, or blank.">
          <input
            value={form.budget}
            onChange={(e) => set("budget", e.target.value)}
            inputMode="decimal"
            placeholder="240"
            className={inputClass}
          />
        </Field>

        <Field label="Term in days" hint="How long before this is revisited.">
          <input
            value={form.termDays}
            onChange={(e) => set("termDays", e.target.value)}
            inputMode="numeric"
            placeholder="90"
            className={inputClass}
          />
        </Field>
      </div>

      {error ? (
        <p className="rounded-md border border-alarm/40 bg-alarm/10 px-3 py-2.5 text-sm text-alarm">
          {error}
        </p>
      ) : null}

      {/* ------------------------------------------------------------ THE GATE */}
      <div className="border-t border-line pt-5">
        {sharp && !stale ? (
          <Card className={ready ? "border-calm/40" : "border-gold-dim"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-lg text-paper">
                {ready ? "Ready to put to people" : "Not ready yet"}
              </h3>
              <Tag tone={ready ? "calm" : "gold"}>
                {sharp.readiness.toFixed(2)} · bar {READINESS_THRESHOLD.toFixed(2)}
              </Tag>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper-dim">
              {sharp.verdict}
            </p>
          </Card>
        ) : null}

        {stale ? (
          <p className="text-sm leading-relaxed text-paper-faint">
            The draft has changed since it was read. Sharpen it again — a
            reading is about one exact set of words, and the database checks
            that too.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={sharpen} disabled={pending}>
            {pending ? "Reading" : sharp ? "Sharpen it again" : "Sharpen this"}
          </Button>

          <Button
            type="button"
            tone={ready ? "gold" : "quiet"}
            onClick={submit}
            disabled={pending || !ready}
          >
            Submit
          </Button>

          <Button type="button" tone="ghost" onClick={discard} disabled={pending}>
            Discard draft
          </Button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-paper-faint">
          Nothing is submitted until a sharpening of this exact draft clears{" "}
          {READINESS_THRESHOLD.toFixed(2)}. The database refuses it otherwise —
          the disabled button is a courtesy, not the rule. Asking again about
          the same words can only lower where you stand; to score better,
          change the proposal.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-paper-faint">
          Once submitted it goes as written and cannot be edited. Amendments
          belong in the deliberation thread, where everyone can see what changed
          and why.
        </p>
      </div>
    </div>
  );
}
