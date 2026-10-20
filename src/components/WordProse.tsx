"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Prose, with the group's Words marked where they appear (Mackenzie, 20
 * October). A word the group has raised gets a dotted underline; tapping it
 * shows what people take it to mean, in the order they first wrote it, with
 * a link to the word's page.
 *
 * This is the group's dictionary laid over the text, not a claim by the
 * proposal: every raised word is marked wherever it appears, in any proposal,
 * and nothing is stored about which proposal used which word (rule 35 holds).
 * No agreement figure is shown, for the same reason Words shows none (rule 30).
 */

export type InlineWord = {
  id: string;
  term: string;
  voices: number;
  readings: { name: string; body: string }[];
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function WordProse({ children, words }: { children: string; words: InlineWord[] }) {
  const [open, setOpen] = useState<InlineWord | null>(null);

  const { pattern, byTerm } = useMemo(() => {
    const sorted = [...words].sort((a, b) => b.term.length - a.term.length);
    return {
      pattern: sorted.length
        ? new RegExp(`(?<![\\p{L}\\p{N}])(${sorted.map((w) => escape(w.term)).join("|")})(?![\\p{L}\\p{N}])`, "giu")
        : null,
      byTerm: new Map(sorted.map((w) => [w.term.toLowerCase(), w])),
    };
  }, [words]);

  const mark = (text: string) => {
    if (!pattern) return text;
    const out: React.ReactNode[] = [];
    let last = 0;
    for (const m of text.matchAll(pattern)) {
      const at = m.index ?? 0;
      const word = byTerm.get(m[0].toLowerCase());
      if (!word) continue;
      if (at > last) out.push(text.slice(last, at));
      out.push(
        <button
          key={`${at}-${m[0]}`}
          type="button"
          onClick={() => setOpen(word)}
          className="cursor-help text-paper underline decoration-gold/70 decoration-dotted underline-offset-4"
        >
          {m[0]}
        </button>,
      );
      last = at + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  return (
    <>
      <div className="space-y-3 text-[0.95rem] leading-relaxed text-paper-dim">
        {children
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((p, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {mark(p.trim())}
            </p>
          ))}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
          onClick={() => setOpen(null)}
        >
          <div
            role="dialog"
            aria-label={`What people mean by ${open.term}`}
            className="w-full max-w-2xl rounded-card border border-line bg-surface px-4 py-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="display text-[1.25rem] text-paper">{open.term}</p>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="press smallcaps text-[11px] text-paper-faint"
              >
                Close
              </button>
            </div>
            {open.readings.length ? (
              <ul className="mt-3 space-y-3">
                {open.readings.map((r, i) => (
                  <li key={i}>
                    <p className="text-[0.9375rem] leading-relaxed text-paper-dim">{r.body}</p>
                    <p className="smallcaps mt-1 text-[10px] text-paper-faint">{r.name}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[0.9375rem] text-paper-dim">Nobody has written what this means yet.</p>
            )}
            <Link href={`/home/words/${open.id}`} className="smallcaps mt-4 inline-block text-[11px] text-gold">
              {open.voices > open.readings.length
                ? `All ${open.voices} readings →`
                : open.readings.length
                  ? "The word's page →"
                  : "Write what you mean by it →"}
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
