"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  clearPreference,
  openContention,
  preferProposal,
  standDown,
} from "@/app/(app)/collective/actions";
import { Button, Card, cx, inputClass } from "@/components/ui";
import type { Contention, ContentionEntry } from "@/lib/types";

/**
 * Two good answers to one question.
 *
 * The panel has one job the copy has to keep doing: make it unmistakable that
 * naming a first choice is NOT a vote on whether either thing happens. Both of
 * these can pass. Both of them may be good. What this settles is which one
 * goes looking for the money first — and, more usefully, which one the group
 * already agreed should happen instead if the first cannot.
 *
 * Nothing about anybody else's choice is shown until every member has closed,
 * for the same reason resonance averages are hidden: a running total is not
 * measuring a preference, it is manufacturing one.
 */
export function Contended({
  proposalId,
  contention,
  entries,
  canStandDown,
  status,
}: {
  proposalId: string;
  contention: Contention;
  entries: ContentionEntry[];
  canStandDown: boolean;
  status: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const mine = entries.find((e) => e.mine);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.95rem] leading-relaxed text-paper" data-selectable>
          {contention.question}
        </p>
        {contention.note ? (
          <p className="mt-1 text-[0.875rem] leading-relaxed text-paper-dim">
            {contention.note}
          </p>
        ) : null}
      </div>

      <ul className="space-y-2">
        {entries.map((e) => {
          const isThis = e.proposal_id === proposalId;
          return (
            <li key={e.proposal_id}>
              <Card className={e.mine ? "border-gold-dim" : undefined}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {isThis ? (
                    <span className="text-[0.95rem] text-paper">{e.title}</span>
                  ) : (
                    <Link
                      href={`/collective/proposals/${e.proposal_id}`}
                      className="text-[0.95rem] text-paper hover:text-gold"
                    >
                      {e.title}
                    </Link>
                  )}

                  <span className="smallcaps text-[10px] text-paper-faint">
                    {isThis ? "this one · " : ""}
                    {e.status.replace("_", " ")}
                  </span>
                </div>

                {contention.resolved_at ? (
                  <p className="mt-2 text-[0.8125rem] leading-relaxed text-paper-dim">
                    {e.passed
                      ? `${e.preferences} first ${e.preferences === 1 ? "choice" : "choices"}${
                          e.order_position === 1
                            ? " · goes first"
                            : e.order_position
                              ? ` · ${ordinal(e.order_position)} in line`
                              : ""
                        }`
                      : "did not pass on its own terms, so it is not in the running"}
                  </p>
                ) : null}

                {!contention.resolved_at ? (
                  <div className="mt-3">
                    <Button
                      tone={e.mine ? "gold" : "quiet"}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          setError(null);
                          const res = e.mine
                            ? await clearPreference(contention.contention_id, proposalId)
                            : await preferProposal(contention.contention_id, e.proposal_id);
                          if (!res.ok) setError(res.error);
                        })
                      }
                    >
                      {e.mine ? "Your first choice" : "Make this my first choice"}
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
        {contention.resolved_at ? (
          <>
            Every one of these was judged on its own — a first choice decided
            none of them. What it decided is the order they go looking for what
            they need. If the one in front cannot gather it and stands down,
            the next takes its turn, and the group chose that in advance
            instead of arguing about it afterwards.
          </>
        ) : (
          <>
            This is not a vote on whether either happens — you still resonate
            with each on its own terms, and both can pass. It answers a
            different question: given that we cannot do both, which one first.{" "}
            {mine ? "You have named one." : "You have not named one."}{" "}
            {contention.responded} of the people who can answer{" "}
            {contention.responded === 1 ? "has" : "have"}. Nobody sees which,
            including you, until every one of these has closed.
          </>
        )}
      </p>

      {canStandDown && status === "passed" && contention.resolved_at ? (
        <StandDown proposalId={proposalId} />
      ) : null}
    </div>
  );
}

function ordinal(n: number) {
  return n === 2 ? "second" : n === 3 ? "third" : `${n}th`;
}

function StandDown({ proposalId }: { proposalId: string }) {
  const [openForm, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!openForm) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="smallcaps text-[10px] text-paper-faint hover:text-gold"
      >
        stand this one down →
      </button>
    );
  }

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Why it is not going ahead."
        className={inputClass}
      />
      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}
      <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
        The record keeps saying this passed. What changes is that it stops
        waiting, and whatever is behind it in the order can take its turn.
        Attributed to you, and not reversible.
      </p>
      <div className="flex gap-2">
        <Button
          tone="gold"
          disabled={pending || reason.trim().length < 20}
          onClick={() =>
            start(async () => {
              const res = await standDown(proposalId, reason);
              if (!res.ok) setError(res.error);
              else setOpen(false);
            })
          }
        >
          {pending ? "…" : "Stand it down"}
        </Button>
        <Button tone="quiet" disabled={pending} onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>
    </div>
  );
}

/* --- declaring one ------------------------------------------------------- */

/**
 * Noticing a clash is not a privilege, so anyone who can reach both can say
 * so. What it costs them is naming the question out loud, which is the part
 * that makes it useful — "the nine hundred on the green" is a decision the
 * group can hold; "these two are similar" is not.
 */
export function OpenContention({
  proposalId,
  candidates,
}: {
  proposalId: string;
  candidates: { id: string; title: string }[];
}) {
  const [openForm, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [other, setOther] = useState(candidates[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!candidates.length) return null;

  if (!openForm) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="smallcaps text-[10px] text-gold hover:underline"
      >
        this is one of two answers to the same question →
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-card border border-dashed border-line bg-surface-soft p-4">
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="The question both of these answer"
        aria-label="The question"
        className={inputClass}
      />

      <select
        value={other}
        onChange={(e) => setOther(e.target.value)}
        aria-label="The other proposal"
        className={cx(inputClass, "appearance-none")}
      >
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
        Both stay open and both are still judged on their own. What this adds
        is a first choice, so that if the one the group prefers cannot gather
        what it needs, the answer to what happens instead is already there.
      </p>

      <div className="flex gap-2">
        <Button
          tone="gold"
          disabled={pending || question.trim().length < 8 || !other}
          onClick={() =>
            start(async () => {
              const res = await openContention({
                question,
                a: proposalId,
                b: other,
              });
              if (!res.ok) setError(res.error);
              else setOpen(false);
            })
          }
        >
          {pending ? "…" : "Say so"}
        </Button>
        <Button tone="quiet" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
