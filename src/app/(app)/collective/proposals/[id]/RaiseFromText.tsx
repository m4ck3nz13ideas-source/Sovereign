"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { sentenceAround } from "@/lib/collective";

import { raiseTermFrom } from "../../lexicon/actions";

/**
 * Select a word while reading a proposal, and raise it in the group's Words.
 *
 * What gets recorded is the word, the sentence you were reading, and your name
 * — a sighting (rule 35). Not a link from the proposal to the word: nothing on
 * this page lists "its" words afterwards, because that list would read as the
 * proposal's vocabulary, which is a claim about what it means.
 *
 * The sentence is taken from the paragraph the selection sits in and sent as
 * it appears. The database refuses it if the proposal does not say it, so a
 * bug here fails loudly rather than attaching a quote nobody wrote.
 */

type Picked = { word: string; excerpt: string };

export function RaiseFromText({
  proposalId,
  children,
}: {
  proposalId: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function onChange() {
      const sel = document.getSelection();
      const root = ref.current;
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !root) {
        setPicked(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        setPicked(null);
        return;
      }

      const word = sel.toString().trim();
      if (word.length < 2 || word.length > 60 || /\n/.test(word)) {
        setPicked(null);
        return;
      }

      // The paragraph the selection starts in, and where in it the selection sits.
      const startEl =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as Element)
          : range.startContainer.parentElement;
      const para = startEl?.closest("p, h1, h2, h3, li") ?? root;
      const before = document.createRange();
      before.setStart(para, 0);
      before.setEnd(range.startContainer, range.startOffset);
      const at = before.toString().length;
      const text = para.textContent ?? "";

      setError(null);
      setPicked({ word, excerpt: sentenceAround(text, at, at + sel.toString().length) });
    }

    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  function raise() {
    if (!picked) return;
    start(async () => {
      const r = await raiseTermFrom(proposalId, picked.word, picked.excerpt);
      if (!r.ok) setError(r.error);
      else router.push(`/collective/lexicon/${r.id}`);
    });
  }

  return (
    <>
      <div ref={ref} data-selectable>
        {children}
      </div>

      {picked ? (
        <div className="fixed inset-x-0 bottom-[4.25rem] z-50 px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-2xl rounded-card border border-line bg-surface px-4 py-3 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-[0.9375rem] leading-snug text-paper">
                Raise <span className="text-gold">&ldquo;{picked.word}&rdquo;</span> in Words
              </p>
              <button
                type="button"
                // Keep the selection alive on touch: a tap that moved focus
                // would collapse it before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={raise}
                disabled={pending}
                className="press smallcaps shrink-0 rounded-pill border border-gold px-3 py-1.5 text-[11px] text-gold disabled:opacity-50"
              >
                {pending ? "Raising" : "Raise"}
              </button>
            </div>
            <p className="mt-1 text-[0.8125rem] leading-snug text-paper-faint">
              Records the sentence you stopped at, with your name, on the
              word&rsquo;s page. It does not mark this proposal as being about it.
            </p>
            {error ? <p className="mt-1 text-sm text-alarm">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
