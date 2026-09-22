"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";

import { submitProposal } from "../../actions";

const DRAFT_KEY = "sovereign.draft.proposal";

/**
 * Drafts live here, in this browser, and nowhere else.
 *
 * This is the third UX rule made literal: private first. A half-formed idea
 * should not be visible to the group, should not be in the shared database,
 * and should not be recoverable by anyone but its author. The cost is that a
 * draft does not follow you between devices — which is the right trade for
 * something you have not decided to say yet.
 */
export function ComposeProposal({
  addresses,
  defaultAddress,
}: {
  addresses: { value: string; label: string; detail: string | null }[];
  defaultAddress: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    summary: "",
    body: "",
    category: "",
    scope: "local" as const,
    budget: "",
    termDays: "",
    address: defaultAddress,
  });
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Reading browser storage has to wait for mount: the server cannot see it,
  // so initialising state from it would desynchronise hydration. This is the
  // "subscribe to an external system" case the rule exists to carve out —
  // localStorage just has no subscription to offer.
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (form.title || form.summary || form.body) {
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

  function submit() {
    start(async () => {
      setError(null);
      const r = await submitProposal(form);
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
    setForm({
      title: "",
      summary: "",
      body: "",
      category: "",
      scope: "local",
      budget: "",
      termDays: "",
      address: defaultAddress,
    });
    setRestored(false);
  }

  return (
    <div className="space-y-5">
      {restored ? (
        <p className="smallcaps rounded-md border border-line bg-surface-soft px-3 py-2 text-[10px] text-paper-faint">
          a draft was waiting in this browser
        </p>
      ) : null}

      <Field
        label="Who this is for"
        hint="The lowest scale that can actually decide it. A thing your street can settle does not belong in front of a country."
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

      <Field label="Title">
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Move the Thursday session to a paid room"
          className={inputClass}
        />
      </Field>

      <Field
        label="In one line"
        hint="What someone would tell a member who missed the meeting."
      >
        <input
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field
        label="The proposal"
        hint="What exactly would change, what it would take, and what you are unsure about. The reviewer will score clarity, so say the awkward part."
      >
        <textarea
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          rows={14}
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </Field>

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
            placeholder="480"
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

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Submitting" : "Submit for review"}
        </Button>
        <Button type="button" tone="ghost" onClick={discard} disabled={pending}>
          Discard draft
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-paper-faint">
        Submitting is not reversible in the way editing a document is. The
        proposal goes to the group as written, is read by the review layer, and
        cannot be edited afterwards — amendments belong in the deliberation
        thread, where the group can see what changed and why.
      </p>
    </div>
  );
}
