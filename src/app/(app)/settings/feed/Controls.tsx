"use client";

import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";
import { POST_KINDS, type PostKind } from "@/lib/types";

import { saveFeedSettings, toggleMute } from "../../collective/actions";

/**
 * The reader's own controls.
 *
 *   "Filter Feed, Timed Scroll, Mindful Mode, Digital Sabbath."       Overview
 *
 * All four are the same idea and all four belong here rather than on the
 * publishing side: the person reading decides what this costs them. Nothing
 * set on this screen changes what anybody else sees.
 *
 * The limit and the quiet days are advisory and say so. A limit that cannot be
 * passed is one people route around by not opening the app, and locking
 * somebody out of their own governance tool on a Sunday would be a worse
 * failure than showing them a line they drew and crossed.
 */

const SAYS: Record<PostKind, string> = {
  made: "things people made",
  saw: "things people saw",
  asked: "questions",
  thanks: "gratitude",
  learned: "what people learned",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function Controls({
  initialShows,
  initialMinutes,
  initialQuietDays,
  muted,
}: {
  initialShows: PostKind[];
  initialMinutes: number | null;
  initialQuietDays: number[];
  muted: { profile_id: string; display_name: string; handle: string | null }[];
}) {
  const [shows, setShows] = useState<PostKind[]>(initialShows);
  const [minutes, setMinutes] = useState(initialMinutes ? String(initialMinutes) : "");
  const [quiet, setQuiet] = useState<number[]>(initialQuietDays);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      setError(null);
      setSaved(false);
      const r = await saveFeedSettings({
        shows,
        minutes: minutes ? Number(minutes) : null,
        quietDays: quiet,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="smallcaps text-[10px] text-paper-faint">What arrives</p>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-paper-dim">
          Choose nothing and everything arrives. This only ever narrows your own
          feed — what people write is not affected by it.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {POST_KINDS.map((k) => {
            const on = shows.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setShows((cur) => (on ? cur.filter((x) => x !== k) : [...cur, k]))
                }
                className={`smallcaps rounded-full border px-3 py-1.5 text-[10px] transition-colors ${
                  on
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-line text-paper-faint hover:text-paper-dim"
                }`}
              >
                {SAYS[k]}
              </button>
            );
          })}
        </div>
        {shows.length === 0 ? (
          <p className="mt-2 text-xs text-paper-faint">Everything arrives.</p>
        ) : null}
      </section>

      <section>
        <p className="smallcaps text-[10px] text-paper-faint">How long you meant to be here</p>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-paper-dim">
          A line you draw, shown back to you when you cross it. Nothing locks.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            placeholder="No limit"
            className={`${inputClass} w-32`}
          />
          <span className="text-sm text-paper-faint">minutes</span>
        </div>
      </section>

      <section>
        <p className="smallcaps text-[10px] text-paper-faint">Days you would rather not</p>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-paper-dim">
          The feed greets you plainly on these days instead of filling. Your
          proposals and your projects are untouched — a sabbath from the feed is
          not a sabbath from what the group is deciding.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const on = quiet.includes(i);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setQuiet((cur) => (on ? cur.filter((x) => x !== i) : [...cur, i]))
                }
                className={`smallcaps rounded-full border px-3 py-1.5 text-[10px] transition-colors ${
                  on
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-line text-paper-faint hover:text-paper-dim"
                }`}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </section>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      {saved ? <p className="text-sm text-paper-dim">Saved.</p> : null}

      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving" : "Save"}
      </Button>

      {muted.length ? (
        <section className="border-t border-line-soft pt-6">
          <p className="smallcaps text-[10px] text-paper-faint">Quieted</p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-paper-dim">
            Still reachable, just not arriving. They are not told, and there is
            no way for them to find out.
          </p>
          <ul className="mt-3 divide-y divide-line-soft">
            {muted.map((m) => (
              <MutedRow key={m.profile_id} person={m} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MutedRow({
  person,
}: {
  person: { profile_id: string; display_name: string; handle: string | null };
}) {
  const [pending, start] = useTransition();

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <p className="text-[0.9375rem] text-paper">
        {person.display_name}
        {person.handle ? (
          <span className="text-paper-faint"> · @{person.handle}</span>
        ) : null}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { await toggleMute(person.profile_id); })}
        className="smallcaps text-[10px] text-paper-faint transition-colors hover:text-paper-dim"
      >
        {pending ? "…" : "unquiet"}
      </button>
    </li>
  );
}
