import { SectionLabel } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { AffectedReached, ChallengeConditions, ChallengeReply, RequirementAnswer, RunConditions } from "./ConditionsClient";

export interface Conditions {
  proposal_id: string;
  min_voices: number;
  requirements: string[];
  affected: string[];
  rationale: string;
  model: string;
  closes_at: string | null;
  window_hours: number | null;
}

/**
 * What this proposal needs before it can be decided (0039). Set by the AI for
 * this proposal alone, once, before anybody responded — and shown with its
 * reasons so a soft bar is visible to the people it affects.
 */
export async function ConditionsSection({
  proposalId,
  conditions,
  open,
  voters,
}: {
  proposalId: string;
  conditions: Conditions | null;
  open: boolean;
  voters: number;
}) {
  if (!conditions) {
    return open && voters === 0 ? (
      <section className="mb-10">
        <SectionLabel>What it needs</SectionLabel>
        <RunConditions proposalId={proposalId} />
      </section>
    ) : null;
  }

  const supabase = await createClient();
  const [{ data }, { data: challengeRows }, { data: replyRows }, { data: revisionRows }, { data: auth }] = await Promise.all([
    supabase
      .from("proposal_requirement_answers")
      .select("kind, idx, answer, answered_at, profiles:answered_by(display_name)")
      .eq("proposal_id", proposalId),
    supabase
      .from("condition_challenges")
      .select("id, challenger_id, argument, answered_at, created_at")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true }),
    supabase
      .from("condition_challenge_replies")
      .select("id, challenge_id, body, created_at, profiles:author_id(display_name)")
      .order("created_at", { ascending: true }),
    supabase
      .from("condition_revisions")
      .select("id, rationale, revised_at")
      .eq("proposal_id", proposalId)
      .order("revised_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);
  type Ans = { kind: string; idx: number; answer: string; profiles: { display_name: string } | null };
  const rows = (data ?? []) as unknown as Ans[];
  const answers = new Map(rows.filter((a) => a.kind === "requirement").map((a) => [a.idx, a]));
  const reached = new Map(rows.filter((a) => a.kind === "affected").map((a) => [a.idx, a]));
  const challenges = (challengeRows ?? []) as {
    id: string;
    challenger_id: string;
    argument: string;
    answered_at: string | null;
  }[];
  const revisions = (revisionRows ?? []) as { id: string; rationale: string; revised_at: string }[];
  const me = auth.user?.id ?? null;
  const replies = (replyRows ?? []) as unknown as {
    id: string;
    challenge_id: string;
    body: string;
    profiles: { display_name: string } | null;
  }[];
  // Before anybody responds a challenge can update the conditions; after, it
  // is debate only (0042).
  const fixed = voters > 0;
  const myUnread = !fixed && challenges.some((c) => c.challenger_id === me && !c.answered_at);

  return (
    <section className="mb-10">
      <SectionLabel>What it needs</SectionLabel>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-line px-4 py-3">
          <p className="font-serif text-2xl tabular-nums text-paper">
            {voters}
            <span className="text-paper-faint"> / {conditions.min_voices}</span>
          </p>
          <p className="text-xs text-paper-faint">voices</p>
        </div>
        <div className="rounded-card border border-line px-4 py-3">
          {conditions.closes_at ? (
            <>
              <p className="font-serif text-lg text-paper">{shortDate(conditions.closes_at)}</p>
              <p className="text-xs text-paper-faint">decided after</p>
            </>
          ) : (
            <>
              <p className="font-serif text-lg text-paper">When met</p>
              <p className="text-xs text-paper-faint">no time limit — decided once everything here is done</p>
            </>
          )}
        </div>
      </div>

      {conditions.requirements.length ? (
        <ol className="mt-4 space-y-3">
          {conditions.requirements.map((req, i) => {
            const a = answers.get(i + 1);
            return (
              <li key={i} className="rounded-card border border-line px-4 py-3">
                <p className="text-[0.95rem] text-paper">{req}</p>
                {a ? (
                  <p className="mt-2 text-sm leading-relaxed text-paper-dim">
                    {a.answer}
                    <span className="text-paper-faint"> — {a.profiles?.display_name ?? "a member"}</span>
                  </p>
                ) : open ? (
                  <RequirementAnswer proposalId={proposalId} idx={i + 1} />
                ) : (
                  <p className="mt-2 text-sm text-alarm">Not answered</p>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      {conditions.affected.length ? (
        <div className="mt-4">
          <p className="smallcaps mb-2 text-[10px] text-paper-faint">Who must have had the chance to take part</p>
          <ol className="space-y-3">
            {conditions.affected.map((who, i) => {
              const r = reached.get(i + 1);
              return (
                <li key={i} className="rounded-card border border-line px-4 py-3">
                  <p className="text-[0.95rem] text-paper">{who}</p>
                  {r ? (
                    <p className="mt-2 text-sm leading-relaxed text-paper-dim">
                      {r.answer}
                      <span className="text-paper-faint"> — {r.profiles?.display_name ?? "a member"}</span>
                    </p>
                  ) : open ? (
                    <AffectedReached proposalId={proposalId} idx={i + 1} />
                  ) : (
                    <p className="mt-2 text-sm text-alarm">Not reached</p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {revisions.length ? (
        <ul className="mt-4 space-y-1 text-xs text-paper-faint">
          {revisions.map((r) => (
            <li key={r.id}>
              Strengthened {shortDate(r.revised_at)} after a challenge: {r.rationale}
            </li>
          ))}
        </ul>
      ) : null}

      {challenges.length ? (
        <div className="mt-4 space-y-3">
          <p className="smallcaps text-[10px] text-paper-faint">Challenges to these conditions</p>
          {challenges.map((c) => (
            <div key={c.id} className="rounded-card border border-line px-4 py-3">
              <p className="text-sm text-paper">{c.argument}</p>
              {replies
                .filter((r) => r.challenge_id === c.id)
                .map((r) => (
                  <p key={r.id} className="mt-2 border-l border-line pl-3 text-sm text-paper-dim">
                    {r.body}
                    <span className="text-paper-faint"> — {r.profiles?.display_name ?? "a member"}</span>
                  </p>
                ))}
              {open ? <ChallengeReply proposalId={proposalId} challengeId={c.id} /> : null}
            </div>
          ))}
        </div>
      ) : null}

      {open ? <ChallengeConditions proposalId={proposalId} fixed={fixed} unread={myUnread} /> : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-paper-faint">Why these</summary>
        <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">{conditions.rationale}</p>
      </details>
    </section>
  );
}
